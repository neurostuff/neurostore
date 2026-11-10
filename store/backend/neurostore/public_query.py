"""Public aggregate queries over the `public_query` datasets, in a subset of Socrata's SoQL.

A query is a dataset and the `$select`, `$where`, `$group`, `$having`, `$order`,
`$limit`, `$offset` and `$q` parameters. Each parameter parses with one grammar and
compiles to SQLAlchemy Core through `DATASETS` and `FUNCTIONS`: a name outside them is an
error that lists what is allowed, so nothing but a dataset's columns, these functions and
literals reaches SQL. The datasets hold public rows only (migrations e5b7d9f1a3c4 and
b8d0f2a4c6e9).

A query runs in its own read-only transaction on a small pool, as the role that can read
only the datasets, after its planned cost is checked against the caller's limit.
docs/public-query/DESIGN.md has the reasoning and the measurements.
"""

import hashlib
import json
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal

import sqlalchemy as sa
from lark import Lark, Token, Transformer, v_args
from lark.exceptions import LarkError, VisitError
from sqlalchemy.dialects import postgresql

from neurostore.database import db
from neurostore.exceptions.utils.error_helpers import abort_unprocessable, abort_validation
from neurostore.models import BaseStudy
from neurostore.resources.text_search import (
    bm25_clause,
    pubmed_to_tsquery,
    tsquery_has_positive_term,
    validate_search_query,
)

SCHEMA = "public_query"
READER = "neurostore_public_query"
TEXT, INTEGER, NUMERIC, BOOLEAN, TIMESTAMP = "text", "integer", "numeric", "boolean", "timestamp"
NULL = "null"
NUMBERS = {INTEGER, NUMERIC}

DEFAULT_LIMIT = 100
MAX_LIMIT = 1000
MAX_OFFSET = 10_000
MAX_SELECT = 10
MAX_GROUP = 5
MAX_IN = 100
MAX_PARAMETER_LENGTH = 2000
#: The planned cost a query may reach (EXPLAIN's total cost), anonymously or with an
#: API key; measured against run time in the design doc.
ANONYMOUS_COST = 50_000
API_KEY_COST = 500_000
#: Settings each query's transaction runs under.
SETTINGS = {
    "statement_timeout": "5s",
    "work_mem": "16MB",
    "temp_file_limit": "256MB",
    "max_parallel_workers_per_gather": "0",
    "jit": "off",
}
CACHE_SECONDS = 3600


# ---------------------------------------------------------------------------
# the datasets
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Dataset:
    """A materialized view of public rows: its name in the API, its view, its key and
    its columns with their types."""

    name: str
    view: str
    description: str
    key: tuple
    columns: dict
    #: Whether `$q` searches it.
    searchable: bool = False
    table: object = field(init=False, compare=False, repr=False)

    def __post_init__(self):
        table = sa.table(self.view, *(sa.column(c) for c in self.columns), schema=SCHEMA)
        object.__setattr__(self, "table", table)


_BASE_STUDY_FLAGS = {
    "has_coordinates": BOOLEAN,
    "has_images": BOOLEAN,
}

DATASETS = {
    dataset.name: dataset
    for dataset in (
        Dataset(
            "base-studies",
            "base_studies",
            "Active, public base studies: one per paper.",
            ("id",),
            {
                "id": TEXT,
                "title": TEXT,
                "year": INTEGER,
                "doi": TEXT,
                "pmid": TEXT,
                "pmcid": TEXT,
                "journal_id": TEXT,
                "journal": TEXT,
                "journal_abbreviation": TEXT,
                "is_oa": BOOLEAN,
                "publication_status": TEXT,
                "is_retracted": BOOLEAN,
                "license": TEXT,
                "level": TEXT,
                **_BASE_STUDY_FLAGS,
                "has_z_maps": BOOLEAN,
                "has_t_maps": BOOLEAN,
                "has_beta_and_variance_maps": BOOLEAN,
                "created_at": TIMESTAMP,
                "updated_at": TIMESTAMP,
            },
            searchable=True,
        ),
        Dataset(
            "journals",
            "journals",
            "Journals, with how many public base studies each has, and how many of "
            "those have coordinates or images.",
            ("id",),
            {
                "id": TEXT,
                "openalex_id": TEXT,
                "kind": TEXT,
                "title": TEXT,
                "abbreviation": TEXT,
                "issn_l": TEXT,
                "nlm_id": TEXT,
                "wikidata_id": TEXT,
                "base_studies": INTEGER,
                "base_studies_with_data": INTEGER,
            },
        ),
        Dataset(
            "authors",
            "authors",
            "Authors of public base studies, with how many each wrote and how many of "
            "those have coordinates or images.",
            ("id",),
            {
                "id": TEXT,
                "name": TEXT,
                "orcid": TEXT,
                "openalex_id": TEXT,
                "base_studies": INTEGER,
                "base_studies_with_data": INTEGER,
            },
        ),
        Dataset(
            "authorships",
            "authorships",
            "Each author of each public base study, with the base study's year, journal "
            "and data.",
            ("base_study_id", "position"),
            {
                "base_study_id": TEXT,
                "author_id": TEXT,
                "author_name": TEXT,
                "printed_name": TEXT,
                "orcid": TEXT,
                "openalex_id": TEXT,
                "position": INTEGER,
                "corresponding": BOOLEAN,
                "year": INTEGER,
                "journal_id": TEXT,
                **_BASE_STUDY_FLAGS,
            },
        ),
        Dataset(
            "institutions",
            "institutions",
            "Research organizations (ROR) named by public base studies' authors, with how "
            "many base studies name each.",
            ("id",),
            {
                "id": TEXT,
                "ror": TEXT,
                "name": TEXT,
                "country": TEXT,
                "base_studies": INTEGER,
            },
        ),
        Dataset(
            "affiliations",
            "affiliations",
            "Each institution each public base study names, once.",
            ("base_study_id", "institution_id"),
            {
                "base_study_id": TEXT,
                "institution_id": TEXT,
                "institution": TEXT,
                "ror": TEXT,
                "country": TEXT,
                "year": INTEGER,
                "journal_id": TEXT,
            },
        ),
        Dataset(
            "studies",
            "studies",
            "Public studies (versions of base studies, and Compose's meta-analysis "
            "projects at level meta), with their owner's username.",
            ("id",),
            {
                "id": TEXT,
                "base_study_id": TEXT,
                "name": TEXT,
                "year": INTEGER,
                "level": TEXT,
                "source": TEXT,
                "username": TEXT,
                "created_at": TIMESTAMP,
                "updated_at": TIMESTAMP,
                **_BASE_STUDY_FLAGS,
            },
        ),
        Dataset(
            "analyses",
            "analyses",
            "Analyses of public studies, with their study's level and source.",
            ("id",),
            {
                "id": TEXT,
                "study_id": TEXT,
                "base_study_id": TEXT,
                "name": TEXT,
                "level": TEXT,
                "source": TEXT,
                "point_count": INTEGER,
                "image_count": INTEGER,
                **_BASE_STUDY_FLAGS,
                "role": TEXT,
                "outcome": TEXT,
                "created_at": TIMESTAMP,
                "updated_at": TIMESTAMP,
            },
        ),
        Dataset(
            "data-sources",
            "data_sources",
            "Studies (cohorts), consortia and repositories data can come from, with how "
            "many public base studies use each and how many of those have coordinates "
            "or images.",
            ("id",),
            {
                "id": TEXT,
                "name": TEXT,
                "kinds": TEXT,
                "modalities": TEXT,
                "part_of_id": TEXT,
                "url": TEXT,
                "rrids": TEXT,
                "base_studies": INTEGER,
                "base_studies_with_data": INTEGER,
            },
        ),
        Dataset(
            "data-source-uses",
            "data_source_uses",
            "Each data source each public base study uses, once, with the base study's "
            "year, journal and data.",
            ("base_study_id", "data_source_id"),
            {
                "base_study_id": TEXT,
                "data_source_id": TEXT,
                "data_source": TEXT,
                "year": INTEGER,
                "journal_id": TEXT,
                **_BASE_STUDY_FLAGS,
            },
        ),
    )
}

REFRESHED = sa.table("refreshed", sa.column("refreshed_at"), schema=SCHEMA)


# ---------------------------------------------------------------------------
# the grammar
# ---------------------------------------------------------------------------

GRAMMAR = r"""
select_list: STAR | select_item ("," select_item)*
select_item: expr (_AS NAME)?
expr_list: expr ("," expr)*
order_list: order_item ("," order_item)*
order_item: expr DIRECTION?

?expr: or_expr
?or_expr: and_expr (_OR and_expr)*
?and_expr: not_expr (_AND not_expr)*
?not_expr: _NOT not_expr -> not_
         | predicate
?predicate: sum_expr
          | sum_expr COMPARISON sum_expr -> compare
          | sum_expr _IS _NULL -> is_null
          | sum_expr _IS _NOT _NULL -> is_not_null
          | sum_expr _IN "(" expr_list ")" -> in_
          | sum_expr _NOT _IN "(" expr_list ")" -> not_in
          | sum_expr _BETWEEN sum_expr _AND sum_expr -> between
          | sum_expr _LIKE STRING -> like
          | sum_expr _NOT _LIKE STRING -> not_like
?sum_expr: atom
         | sum_expr PLUS atom -> arithmetic
         | sum_expr MINUS atom -> arithmetic
?atom: NUMBER -> number
     | STRING -> string
     | _TRUE -> true
     | _FALSE -> false
     | _NULL -> null
     | _COUNT "(" STAR ")" -> count_all
     | _COUNT "(" _DISTINCT expr ")" -> count_distinct
     | _COUNT "(" expr ")" -> count_one
     | NAME "(" expr_list? ")" -> call
     | NAME -> name
     | "(" expr ")"

_AS.2: /as\b/i
_OR.2: /or\b/i
_AND.2: /and\b/i
_NOT.2: /not\b/i
_IS.2: /is\b/i
_NULL.2: /null\b/i
_IN.2: /in\b/i
_BETWEEN.2: /between\b/i
_LIKE.2: /like\b/i
_TRUE.2: /true\b/i
_FALSE.2: /false\b/i
_COUNT.2: /count\b/i
_DISTINCT.2: /distinct\b/i
DIRECTION.2: /(asc|desc)\b/i
COMPARISON: "!=" | "<>" | "<=" | ">=" | "=" | "<" | ">"
PLUS: "+"
MINUS: "-"
STAR: "*"
NAME: /[a-z_][a-z0-9_]*/i
STRING: /'([^']|'')*'/
NUMBER: /\d+(\.\d+)?/
%ignore /\s+/
"""

_PARSERS = {
    start: Lark(GRAMMAR, start=start, parser="lalr")
    for start in ("select_list", "expr", "expr_list", "order_list")
}


class QueryError(Exception):
    """A query that cannot compile: the parameter and why."""

    def __init__(self, parameter, message):
        super().__init__(message)
        self.parameter = parameter
        self.message = message


@dataclass(frozen=True)
class Typed:
    """A compiled expression, its type, and whether it holds an aggregate."""

    sql: object
    type: str
    aggregate: bool = False
    #: The function or column name an unaliased select item is called by.
    name: str = None


def _is(value, *types):
    return value.type == NULL or value.type in types


def _comparable(a, b):
    if a.type == NULL or b.type == NULL:
        return True
    if a.type in NUMBERS and b.type in NUMBERS:
        return True
    return a.type == b.type


def _aggregate(name, sql, type_, *args):
    if any(arg.aggregate for arg in args):
        raise QueryError(None, f"{name} cannot take an aggregate")
    return Typed(sql, type_, aggregate=True, name=name)


def _sum(arg):
    if not _is(arg, *NUMBERS):
        raise QueryError(None, "sum takes a number")
    return _aggregate("sum", sa.func.sum(arg.sql), arg.type, arg)


def _avg(arg):
    if not _is(arg, *NUMBERS):
        raise QueryError(None, "avg takes a number")
    return _aggregate("avg", sa.func.avg(arg.sql), NUMERIC, arg)


def _extreme(name):
    def extreme(arg):
        if arg.type == BOOLEAN:
            raise QueryError(None, f"{name} cannot take a boolean")
        return _aggregate(name, getattr(sa.func, name)(arg.sql), arg.type, arg)

    return extreme


def _count(arg):
    return _aggregate("count", sa.func.count(arg.sql), INTEGER, arg)


def _date_trunc(unit, name):
    def trunc(arg):
        if not _is(arg, TIMESTAMP):
            raise QueryError(None, f"{name} takes a timestamp")
        return Typed(sa.func.date_trunc(unit, arg.sql), TIMESTAMP, arg.aggregate, name)

    return trunc


def _date_extract_y(arg):
    if not _is(arg, TIMESTAMP):
        raise QueryError(None, "date_extract_y takes a timestamp")
    year = sa.cast(sa.extract("year", arg.sql), sa.Integer)
    return Typed(year, INTEGER, arg.aggregate, "date_extract_y")


def _case_change(name):
    def change(arg):
        if not _is(arg, TEXT):
            raise QueryError(None, f"{name} takes text")
        return Typed(getattr(sa.func, name)(arg.sql), TEXT, arg.aggregate, name)

    return change


def _common_type(name, values):
    types = {v.type for v in values} - {NULL}
    if types <= NUMBERS and types:
        return INTEGER if types == {INTEGER} else NUMERIC
    if len(types) > 1:
        raise QueryError(None, f"{name}'s values must share one type")
    return types.pop() if types else NULL


def _coalesce(*args):
    if len(args) < 2:
        raise QueryError(None, "coalesce takes two or more values")
    type_ = _common_type("coalesce", args)
    return Typed(
        sa.func.coalesce(*(a.sql for a in args)),
        type_,
        any(a.aggregate for a in args),
        "coalesce",
    )


def _case(*args):
    if len(args) < 2 or len(args) % 2:
        raise QueryError(None, "case takes pairs of a condition and a value")
    conditions, values = args[0::2], args[1::2]
    if not all(_is(c, BOOLEAN) for c in conditions):
        raise QueryError(None, "case's conditions must be true or false")
    type_ = _common_type("case", values)
    return Typed(
        sa.case(*((c.sql, v.sql) for c, v in zip(conditions, values))),
        type_,
        any(a.aggregate for a in args),
        "case",
    )


def _starts_with(column, prefix):
    if not _is(column, TEXT) or not isinstance(prefix.sql, sa.sql.elements.BindParameter):
        raise QueryError(None, "starts_with takes a text column and a string")
    escaped = str(prefix.sql.value).replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_")
    return Typed(column.sql.like(escaped + "%"), BOOLEAN, column.aggregate, "starts_with")


#: Every function a query may call, by its SoQL name, and how many arguments it takes
#: (None: any number its builder accepts).
FUNCTIONS = {
    "sum": (1, _sum),
    "avg": (1, _avg),
    "min": (1, _extreme("min")),
    "max": (1, _extreme("max")),
    "date_trunc_y": (1, _date_trunc("year", "date_trunc_y")),
    "date_trunc_ym": (1, _date_trunc("month", "date_trunc_ym")),
    "date_extract_y": (1, _date_extract_y),
    "lower": (1, _case_change("lower")),
    "upper": (1, _case_change("upper")),
    "coalesce": (None, _coalesce),
    "case": (None, _case),
    "starts_with": (2, _starts_with),
}


@v_args(inline=True)
class _Compile(Transformer):
    """Compiles one parameter's parse tree over a dataset.

    ``aliases`` maps a `$select` alias to its expression, for the parameters that may
    name one.
    """

    def __init__(self, dataset, aliases=None):
        super().__init__()
        self.dataset = dataset
        self.aliases = aliases or {}

    def name(self, token):
        name = str(token).lower()
        if name in self.aliases:
            return self.aliases[name]
        if name not in self.dataset.columns:
            raise QueryError(
                None,
                f"{self.dataset.name} has no column {name!r}; its columns are "
                + ", ".join(self.dataset.columns),
            )
        return Typed(self.dataset.table.c[name], self.dataset.columns[name], name=name)

    def number(self, token):
        text = str(token)
        if "." in text:
            return Typed(sa.literal(Decimal(text), sa.Numeric), NUMERIC)
        return Typed(sa.literal(int(text), sa.BigInteger), INTEGER)

    def string(self, token):
        return Typed(sa.literal(str(token)[1:-1].replace("''", "'"), sa.Text), TEXT)

    def true(self):
        return Typed(sa.true(), BOOLEAN)

    def false(self):
        return Typed(sa.false(), BOOLEAN)

    def null(self):
        return Typed(sa.null(), NULL)

    def count_all(self, _star):
        return Typed(sa.func.count(), INTEGER, aggregate=True, name="count")

    def count_one(self, arg):
        return _count(arg)

    def count_distinct(self, arg):
        return _aggregate("count", sa.func.count(arg.sql.distinct()), INTEGER, arg)

    def call(self, token, args=None):
        name = str(token).lower()
        if name not in FUNCTIONS:
            raise QueryError(
                None, f"no function {name!r}; the functions are " + ", ".join(FUNCTIONS)
            )
        arity, build = FUNCTIONS[name]
        args = list(args.children) if args is not None else []
        if arity is not None and len(args) != arity:
            raise QueryError(None, f"{name} takes {arity} argument(s)")
        return build(*args)

    def _coerce(self, a, b):
        """A string compared with a timestamp is read as one."""
        if a.type == TIMESTAMP and b.type == TEXT and isinstance(
            b.sql, sa.sql.elements.BindParameter
        ):
            try:
                moment = datetime.fromisoformat(b.sql.value)
            except ValueError:
                raise QueryError(None, f"{b.sql.value!r} is not a date or timestamp")
            return Typed(sa.literal(moment, sa.DateTime(timezone=True)), TIMESTAMP)
        return b

    def compare(self, a, op, b):
        b, a = self._coerce(a, b), self._coerce(b, a)
        if not _comparable(a, b):
            raise QueryError(None, f"cannot compare {a.type} with {b.type}")
        op = {"<>": "!="}.get(str(op), str(op))
        if a.type == BOOLEAN and op not in ("=", "!="):
            raise QueryError(None, "true and false compare only with = and !=")
        sql = {
            "=": lambda: a.sql == b.sql,
            "!=": lambda: a.sql != b.sql,
            "<": lambda: a.sql < b.sql,
            "<=": lambda: a.sql <= b.sql,
            ">": lambda: a.sql > b.sql,
            ">=": lambda: a.sql >= b.sql,
        }[op]()
        return Typed(sql, BOOLEAN, a.aggregate or b.aggregate)

    def is_null(self, a):
        return Typed(a.sql.is_(None), BOOLEAN, a.aggregate)

    def is_not_null(self, a):
        return Typed(a.sql.is_not(None), BOOLEAN, a.aggregate)

    def _members(self, a, members):
        values = [self._coerce(a, m) for m in members.children]
        if len(values) > MAX_IN:
            raise QueryError(None, f"IN takes at most {MAX_IN} values")
        if not all(_comparable(a, v) for v in values):
            raise QueryError(None, f"IN's values must be {a.type}")
        return [v.sql for v in values]

    def in_(self, a, members):
        return Typed(a.sql.in_(self._members(a, members)), BOOLEAN, a.aggregate)

    def not_in(self, a, members):
        return Typed(a.sql.not_in(self._members(a, members)), BOOLEAN, a.aggregate)

    def between(self, a, low, high):
        low, high = self._coerce(a, low), self._coerce(a, high)
        if not (_comparable(a, low) and _comparable(a, high)):
            raise QueryError(None, f"BETWEEN's bounds must be {a.type}")
        return Typed(a.sql.between(low.sql, high.sql), BOOLEAN, a.aggregate)

    def _like(self, a, pattern):
        if not _is(a, TEXT):
            raise QueryError(None, "LIKE takes text")
        return str(pattern)[1:-1].replace("''", "'")

    def like(self, a, pattern):
        return Typed(a.sql.like(self._like(a, pattern)), BOOLEAN, a.aggregate)

    def not_like(self, a, pattern):
        return Typed(a.sql.not_like(self._like(a, pattern)), BOOLEAN, a.aggregate)

    def arithmetic(self, a, op, b):
        if not (_is(a, *NUMBERS) and _is(b, *NUMBERS)):
            raise QueryError(None, "+ and - take numbers")
        type_ = INTEGER if {a.type, b.type} <= {INTEGER, NULL} else NUMERIC
        sql = a.sql + b.sql if str(op) == "+" else a.sql - b.sql
        return Typed(sql, type_, a.aggregate or b.aggregate)

    def _logical(self, parts):
        if not all(_is(p, BOOLEAN) for p in parts):
            raise QueryError(None, "AND, OR and NOT take conditions")

    def or_expr(self, *parts):
        self._logical(parts)
        return Typed(sa.or_(*(p.sql for p in parts)), BOOLEAN, any(p.aggregate for p in parts))

    def and_expr(self, *parts):
        self._logical(parts)
        return Typed(sa.and_(*(p.sql for p in parts)), BOOLEAN, any(p.aggregate for p in parts))

    def not_(self, part):
        self._logical([part])
        return Typed(sa.not_(part.sql), BOOLEAN, part.aggregate)


def _parse(parameter, start, text, dataset, aliases=None):
    if len(text) > MAX_PARAMETER_LENGTH:
        raise QueryError(parameter, f"is longer than {MAX_PARAMETER_LENGTH} characters")
    try:
        tree = _PARSERS[start].parse(text)
        return _Compile(dataset, aliases).transform(tree)
    except VisitError as error:
        if isinstance(error.orig_exc, QueryError):
            raise QueryError(parameter, error.orig_exc.message)
        raise
    except LarkError as error:
        raise QueryError(parameter, f"does not parse: {str(error).splitlines()[0]}")


# ---------------------------------------------------------------------------
# compiling a query
# ---------------------------------------------------------------------------

PARAMETERS = ("$select", "$where", "$group", "$having", "$order", "$limit", "$offset", "$q")


@dataclass
class Compiled:
    dataset: Dataset
    statement: object
    #: Each output column's name and type.
    columns: list
    limit: int
    offset: int
    #: The `$q` search as a tsquery string, or None.
    search: str = None


def _number(params, name, default, maximum):
    raw = params.get(name)
    if raw is None or raw == "":
        return default
    try:
        value = int(raw)
    except (TypeError, ValueError):
        raise QueryError(name, "is a whole number")
    if not 0 <= value <= maximum:
        raise QueryError(name, f"is from 0 to {maximum}")
    return value


def _select_items(dataset, text):
    if text is None or text.strip() in ("", "*"):
        return [
            (name, Typed(dataset.table.c[name], type_, name=name))
            for name, type_ in dataset.columns.items()
        ]
    tree = _PARSERS["select_list"]
    if len(text) > MAX_PARAMETER_LENGTH:
        raise QueryError("$select", f"is longer than {MAX_PARAMETER_LENGTH} characters")
    try:
        items = tree.parse(text).children
    except LarkError as error:
        raise QueryError("$select", f"does not parse: {str(error).splitlines()[0]}")
    if len(items) > MAX_SELECT:
        raise QueryError("$select", f"takes at most {MAX_SELECT} expressions")
    compiled, taken = [], {}
    for item in items:
        if isinstance(item, Token):  # `*` among others
            raise QueryError("$select", "* stands alone")
        expression, *alias = item.children
        try:
            typed = _Compile(dataset).transform(expression)
        except VisitError as error:
            if isinstance(error.orig_exc, QueryError):
                raise QueryError("$select", error.orig_exc.message)
            raise
        if not isinstance(typed, Typed):  # a bare literal parses as a token tree
            raise QueryError("$select", "selects an expression")
        name = str(alias[0]).lower() if alias else (typed.name or "value")
        if alias and name in dataset.columns:
            raise QueryError("$select", f"alias {name!r} is one of the dataset's columns")
        taken[name] = taken.get(name, 0) + 1
        if taken[name] > 1:
            if alias:
                raise QueryError("$select", f"alias {name!r} is used twice")
            name = f"{name}_{taken[name]}"
        compiled.append((name, typed))
    return compiled


def _sql_text(expression):
    return str(expression.compile(dialect=postgresql.dialect()))


def compile_query(dataset_name, params):
    """Compile a dataset name and its `$` parameters, or raise `QueryError`."""
    dataset = DATASETS.get(dataset_name)
    if dataset is None:
        raise QueryError(
            "dataset", f"no dataset {dataset_name!r}; the datasets are " + ", ".join(DATASETS)
        )
    unknown = sorted(set(params) - set(PARAMETERS))
    if unknown:
        raise QueryError(unknown[0], "is not a parameter; they are " + ", ".join(PARAMETERS))

    items = _select_items(dataset, params.get("$select"))
    aliases = {name: typed for name, typed in items}

    where = None
    if params.get("$where"):
        where = _parse("$where", "expr", params["$where"], dataset)
        if where.type != BOOLEAN:
            raise QueryError("$where", "is a condition")
        if where.aggregate:
            raise QueryError("$where", "cannot hold an aggregate; use $having")

    groups = []
    if params.get("$group"):
        groups = _parse("$group", "expr_list", params["$group"], dataset, aliases).children
        if len(groups) > MAX_GROUP:
            raise QueryError("$group", f"takes at most {MAX_GROUP} expressions")
        if any(g.aggregate for g in groups):
            raise QueryError("$group", "cannot hold an aggregate")

    grouped = bool(groups) or any(t.aggregate for _, t in items)
    group_texts = {_sql_text(g.sql) for g in groups}
    for name, typed in items:
        if grouped and not typed.aggregate and _sql_text(typed.sql) not in group_texts:
            raise QueryError(
                "$select", f"{name!r} is neither grouped by $group nor an aggregate"
            )

    having = None
    if params.get("$having"):
        if not grouped:
            raise QueryError("$having", "needs $group or an aggregate in $select")
        having = _parse("$having", "expr", params["$having"], dataset, aliases)
        if having.type != BOOLEAN:
            raise QueryError("$having", "is a condition")

    labels = {name: typed.sql.label(name) for name, typed in items}
    order = []
    if params.get("$order"):
        tree = _parse("$order", "order_list", params["$order"], dataset, aliases)
        for item in tree.children:
            expression, *direction = item.children
            text = _sql_text(expression.sql)
            # An alias orders by its output column.
            alias = next((n for n, t in items if _sql_text(t.sql) == text), None)
            target = labels[alias] if alias else expression.sql
            if grouped and not expression.aggregate and text not in group_texts:
                raise QueryError("$order", f"orders by {text}, which is not grouped")
            descending = bool(direction) and str(direction[0]).lower() == "desc"
            order.append(sa.desc(target).nulls_last() if descending else sa.asc(target))
    # A total order: pages never overlap.
    ties = groups if grouped else [Typed(dataset.table.c[k], TEXT) for k in dataset.key]
    if not grouped or groups:
        order.extend(sa.asc(t.sql) for t in ties)

    statement = sa.select(*labels.values()).select_from(dataset.table)
    if where is not None:
        statement = statement.where(where.sql)
    if groups:
        statement = statement.group_by(*(g.sql for g in groups))
    if having is not None:
        statement = statement.having(having.sql)
    limit = _number(params, "$limit", DEFAULT_LIMIT, MAX_LIMIT)
    offset = _number(params, "$offset", 0, MAX_OFFSET)
    statement = statement.order_by(*order).limit(limit).offset(offset)

    search = None
    if params.get("$q"):
        if not dataset.searchable:
            raise QueryError("$q", f"searches base-studies only, not {dataset.name}")
        search = _search_string(params["$q"])

    columns = [{"name": name, "type": typed.type} for name, typed in items]
    return Compiled(dataset, statement, columns, limit, offset, search)


def _search_string(text):
    try:
        validate_search_query(text)
    except Exception as error:  # the base-study search's own syntax errors
        raise QueryError("$q", str(error.args[0] if error.args else error))
    tsquery = pubmed_to_tsquery(text)
    if not tsquery_has_positive_term(tsquery):
        raise QueryError("$q", "needs at least one word to match")
    return tsquery


# ---------------------------------------------------------------------------
# running a query
# ---------------------------------------------------------------------------

_engines = {}


def _engine():
    """The query's own small pool, so public queries never take the site's
    connections; a query waits at most a second for one."""
    url = db.engine.url
    key = url.render_as_string(hide_password=False)
    if key not in _engines:
        _engines[key] = sa.create_engine(
            url, pool_size=2, max_overflow=0, pool_timeout=1, pool_pre_ping=True
        )
    return _engines[key]


class Busy(Exception):
    """Every connection the public query may use is taken."""


def _matching_base_studies(connection, search):
    title_and_abstract = ((BaseStudy.name, 3), (BaseStudy.description, 2))
    clause = bm25_clause(search, title_and_abstract)
    if clause is None:
        return []
    return connection.scalars(
        sa.select(BaseStudy.id).where(
            BaseStudy.is_active.is_(True), BaseStudy.public.is_(True), clause
        )
    ).all()


def _jsonable(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def run(compiled, *, cost_limit):
    """The rows of a compiled query, run read-only as the datasets' reader.

    Raises `Busy` when no connection is free within a second, and aborts with 422 when
    the planned cost exceeds ``cost_limit`` or the query outlives its time limit.
    """
    try:
        connection = _engine().connect()
    except sa.exc.TimeoutError:
        raise Busy()
    with connection, connection.begin():
        connection.exec_driver_sql("SET TRANSACTION READ ONLY")
        for name, value in SETTINGS.items():
            connection.execute(
                sa.text("SELECT set_config(:name, :value, true)"),
                {"name": name, "value": value},
            )
        statement = compiled.statement
        if compiled.search is not None:
            ids = _matching_base_studies(connection, compiled.search)
            matching = sa.literal(ids, postgresql.ARRAY(sa.Text))
            statement = statement.where(compiled.dataset.table.c.id == sa.any_(matching))
        connection.exec_driver_sql(f"SET LOCAL ROLE {READER}")
        sql = statement.compile(dialect=connection.dialect)
        try:
            plan = connection.exec_driver_sql(
                "EXPLAIN (FORMAT JSON) " + sql.string, sql.params
            ).scalar_one()
            cost = plan[0]["Plan"]["Total Cost"]
            if cost > cost_limit:
                abort_unprocessable(
                    f"This query's planned cost is {cost:,.0f}, over the limit of "
                    f"{cost_limit:,}. Narrow it with $where, group by fewer columns, or "
                    "use an API key for a higher limit."
                )
            rows = connection.execute(statement).all()
        except sa.exc.OperationalError as error:
            if getattr(error.orig, "pgcode", None) == "57014":  # query_canceled
                abort_unprocessable(
                    f"This query ran past the {SETTINGS['statement_timeout']} limit."
                )
            raise
    return [[_jsonable(v) for v in row] for row in rows]


def refreshed_at():
    """When the datasets were last refreshed: the version a cached answer carries."""
    return db.session.execute(sa.select(REFRESHED.c.refreshed_at)).scalar_one()


def refresh_datasets():
    """Rebuild every dataset from the current public rows, in one transaction, without
    blocking readers, and stamp the time."""
    with db.engine.begin() as connection:
        for dataset in DATASETS.values():
            connection.exec_driver_sql(
                f"REFRESH MATERIALIZED VIEW CONCURRENTLY {SCHEMA}.{dataset.view}"
            )
        connection.execute(sa.update(REFRESHED).values(refreshed_at=sa.func.now()))


def cache_key(compiled, version):
    """The key a compiled query's answer is cached under, and its ETag."""
    sql = compiled.statement.compile(
        dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}
    )
    canonical = json.dumps(
        [compiled.dataset.name, str(sql), compiled.search, version.isoformat()]
    )
    return "public-query:" + hashlib.sha256(canonical.encode()).hexdigest()


def list_datasets():
    """Every dataset, its key and its columns: the allow-list, served."""
    return {
        "refreshed_at": _jsonable(refreshed_at()),
        "results": [
            {
                "name": d.name,
                "description": d.description,
                "key": list(d.key),
                "columns": [{"name": c, "type": t} for c, t in d.columns.items()],
            }
            for d in DATASETS.values()
        ],
    }


def query_error(error):
    """Abort with 400 for a query that does not compile."""
    abort_validation(f"{error.parameter} {error.message}")

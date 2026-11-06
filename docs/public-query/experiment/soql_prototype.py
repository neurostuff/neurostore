"""Throwaway: a SoQL subset compiled to SQLAlchemy over allow-listed datasets.

Only names in DATASETS and FUNCTIONS compile; everything else is a 422-style error.
Prints the compiled SQL (literal binds, for psql) and the parse+compile time.
"""

import sys
import time
from dataclasses import dataclass

import sqlalchemy as sa
from lark import Lark, Transformer, v_args
from sqlalchemy.dialects import postgresql

GRAMMAR = r"""
select_list: select_item ("," select_item)*
select_item: expr ("as"i NAME)?
expr_list: expr ("," expr)*
order_list: order_item ("," order_item)*
order_item: expr ORDER_DIR?
ORDER_DIR: "asc"i | "desc"i

?expr: or_expr
?or_expr: and_expr ("or"i and_expr)*   -> or_
?and_expr: not_expr ("and"i not_expr)* -> and_
?not_expr: "not"i not_expr -> not_
         | predicate
?predicate: sum_expr
          | sum_expr COMP sum_expr                       -> compare
          | sum_expr "is"i "null"i                       -> is_null
          | sum_expr "is"i "not"i "null"i                -> is_not_null
          | sum_expr "in"i "(" expr_list ")"             -> in_
          | sum_expr "not"i "in"i "(" expr_list ")"      -> not_in
          | sum_expr "between"i sum_expr "and"i sum_expr -> between
          | sum_expr "like"i STRING                      -> like
COMP: "=" | "!=" | "<>" | "<=" | ">=" | "<" | ">"
?sum_expr: atom
         | sum_expr "+" atom -> add
         | sum_expr "-" atom -> sub
?atom: NUMBER -> number
     | STRING -> string
     | "true"i -> true
     | "false"i -> false
     | "count"i "(" "*" ")" -> count_star
     | "count"i "(" "distinct"i expr ")" -> count_distinct
     | NAME "(" [expr_list] ")" -> call
     | NAME -> column
     | "(" expr ")"

NAME: /[a-z_][a-z0-9_]*/i
STRING: /'([^']|'')*'/
NUMBER: /-?\d+(\.\d+)?/
%ignore /\s+/
"""


class QueryError(Exception):
    pass


@dataclass(frozen=True)
class Dataset:
    table: object
    #: Columns a query may name; nothing else of the view is reachable.
    columns: tuple


def _view(name, *cols):
    return Dataset(sa.table(name, *(sa.column(c) for c in cols), schema="public_api"), cols)


DATASETS = {
    "articles": _view(
        "articles", "id", "title", "year", "doi", "pmid", "journal_id", "journal",
        "is_oa", "publication_status", "is_retracted", "has_coordinates", "has_images",
        "created_at", "updated_at",
    ),
    "authorships": _view(
        "authorships_flat", "article_id", "author_id", "author_name", "orcid", "position",
        "year", "journal_id", "has_coordinates", "has_images",
    ),
    "affiliations": _view(
        "affiliations_flat", "article_id", "institution_id", "institution", "ror", "country", "year",
    ),
    "studies": _view(
        "studies", "id", "article_id", "name", "year", "level", "source", "username",
        "created_at", "updated_at",
    ),
}

FUNCTIONS = {
    # aggregates
    "count": (1, sa.func.count, True),
    "sum": (1, sa.func.sum, True),
    "avg": (1, sa.func.avg, True),
    "min": (1, sa.func.min, True),
    "max": (1, sa.func.max, True),
    # scalars (SoQL names)
    "date_trunc_y": (1, lambda e: sa.func.date_trunc("year", e), False),
    "date_trunc_ym": (1, lambda e: sa.func.date_trunc("month", e), False),
    "date_extract_y": (1, lambda e: sa.extract("year", e), False),
    "lower": (1, sa.func.lower, False),
    "case": (None, lambda *a: sa.case(*zip(a[0::2], a[1::2])), False),
}
MAX_LIMIT = 1000
DEFAULT_LIMIT = 100


@v_args(inline=True)
class Compile(Transformer):
    def __init__(self, dataset, aliases):
        super().__init__()
        self.dataset = dataset
        self.aliases = aliases
        self.aggregates = 0

    def column(self, name):
        name = str(name).lower()
        if name in self.aliases:
            return sa.literal_column(name)
        if name not in self.dataset.columns:
            raise QueryError(f"unknown column {name!r}; allowed: {', '.join(self.dataset.columns)}")
        return self.dataset.table.c[name]

    def number(self, tok):
        return sa.literal(float(tok) if "." in tok else int(tok))

    def string(self, tok):
        return sa.literal(str(tok)[1:-1].replace("''", "'"))

    def true(self):
        return sa.true()

    def false(self):
        return sa.false()

    def count_star(self):
        self.aggregates += 1
        return sa.func.count()

    def count_distinct(self, e):
        self.aggregates += 1
        return sa.func.count(e.distinct())

    def call(self, name, args=None):
        name = str(name).lower()
        args = list(args.children) if args is not None else []
        if name not in FUNCTIONS:
            raise QueryError(f"unknown function {name!r}; allowed: {', '.join(FUNCTIONS)}")
        arity, fn, aggregate = FUNCTIONS[name]
        if arity is not None and len(args) != arity:
            raise QueryError(f"{name} takes {arity} argument(s)")
        self.aggregates += aggregate
        return fn(*args)

    def compare(self, a, op, b):
        return {"=": a.__eq__, "!=": a.__ne__, "<>": a.__ne__, "<": a.__lt__,
                "<=": a.__le__, ">": a.__gt__, ">=": a.__ge__}[str(op)](b)

    def is_null(self, a):
        return a.is_(None)

    def is_not_null(self, a):
        return a.is_not(None)

    def in_(self, a, lst):
        return a.in_(lst.children)

    def not_in(self, a, lst):
        return a.not_in(lst.children)

    def between(self, a, lo, hi):
        return a.between(lo, hi)

    def like(self, a, pattern):
        return a.like(self.string(pattern).value)

    def add(self, a, b):
        return a + b

    def sub(self, a, b):
        return a - b

    def or_(self, *xs):
        return sa.or_(*xs)

    def and_(self, *xs):
        return sa.and_(*xs)

    def not_(self, x):
        return sa.not_(x)


PARSERS = {start: Lark(GRAMMAR, start=start, parser="lalr")
           for start in ("select_list", "expr", "expr_list", "order_list")}


def compile_query(dataset_name, params):
    unknown = set(params) - {"$select", "$where", "$group", "$having", "$order", "$limit", "$offset"}
    if unknown:
        raise QueryError(f"unknown parameters {sorted(unknown)}")
    if dataset_name not in DATASETS:
        raise QueryError(f"unknown dataset {dataset_name!r}")
    ds = DATASETS[dataset_name]
    aliases = set()
    sel = Compile(ds, aliases)
    items = []
    for item in PARSERS["select_list"].parse(",".join(ds.columns) if (params.get("$select") or "*").strip() == "*" else params["$select"]).children:
        expr = sel.transform(item.children[0])
        name = str(item.children[1]).lower() if len(item.children) > 1 and item.children[1] else None
        if name:
            aliases.add(name)
        items.append(expr.label(name) if name else expr)
    stmt = sa.select(*items).select_from(ds.table)
    where = Compile(ds, set())
    if params.get("$where"):
        stmt = stmt.where(where.transform(PARSERS["expr"].parse(params["$where"])))
        if where.aggregates:
            raise QueryError("aggregates belong in $having")
    group = Compile(ds, set())
    if params.get("$group"):
        stmt = stmt.group_by(*group.transform(PARSERS["expr_list"].parse(params["$group"])).children)
    if params.get("$having"):
        stmt = stmt.having(Compile(ds, aliases).transform(PARSERS["expr"].parse(params["$having"])))
    if params.get("$order"):
        order = Compile(ds, aliases)
        for oi in PARSERS["order_list"].parse(params["$order"]).children:
            e = order.transform(oi.children[0])
            desc = len(oi.children) > 1 and str(oi.children[1]).lower() == "desc"
            stmt = stmt.order_by(e.desc().nulls_last() if desc else e.asc())
    limit = int(params.get("$limit", DEFAULT_LIMIT))
    if not 0 <= limit <= MAX_LIMIT:
        raise QueryError(f"$limit is 0 to {MAX_LIMIT}")
    return stmt.limit(limit).offset(int(params.get("$offset", 0)))


USE_CASES = {
    "uc1": ("articles", {"$select": "year, count(*) as articles", "$group": "year", "$order": "year"}),
    "uc2": ("articles", {"$select": "journal_id, journal, count(*) as articles",
                         "$where": "journal_id is not null",
                         "$group": "journal_id, journal", "$order": "articles desc"}),
    "uc3": ("authorships", {"$select": "author_id, author_name, orcid, "
                            "sum(case(has_coordinates or has_images, 1, true, 0)) as with_data, "
                            "count(*) as articles",
                            "$group": "author_id, author_name, orcid",
                            "$order": "with_data desc, articles desc"}),
    "uc4": ("affiliations", {"$select": "institution_id, institution, country, count(distinct article_id) as articles",
                             "$where": "institution_id is not null",
                             "$group": "institution_id, institution, country", "$order": "articles desc"}),
    "uc5": ("studies", {"$select": "username, count(*) as updated_studies",
                        "$where": "username is not null and updated_at is not null",
                        "$group": "username", "$order": "updated_studies desc"}),
    "uc6": ("studies", {"$select": "date_trunc_ym(created_at) as month, count(*) as meta_analyses",
                        "$where": "level = 'meta' and created_at between '2023-01-01' and '2026-11-01'",
                        "$group": "date_trunc_ym(created_at)", "$order": "month"}),
}

if __name__ == "__main__":
    which = sys.argv[1:] or list(USE_CASES)
    for key in which:
        ds, params = USE_CASES[key]
        t0 = time.perf_counter()
        for _ in range(200):
            stmt = compile_query(ds, params)
            str(stmt.compile(dialect=postgresql.dialect()))  # timed, not used
        dt = (time.perf_counter() - t0) / 200 * 1000
        literal = stmt.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True})
        print(f"-- {key}: parse+compile {dt:.2f} ms")
        print(f"\\echo {key}\nexplain (analyze, buffers, summary) {literal};")

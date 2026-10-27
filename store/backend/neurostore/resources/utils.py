"""
Resource-specific utilities for View construction and function
"""

import re
from typing import Callable, NamedTuple

import sqlalchemy as sa
from connexion.context import context
from pgvector.sqlalchemy import Vector
from psycopg2 import errors
from sqlalchemy import func

from neurostore import models, schemas
from neurostore.encryption import EncryptedText
from neurostore.database import db
from neurostore.exceptions.utils.error_helpers import abort_validation
from neurostore.models.migration_types import TSVector
from neurostore.resources.singular import singularize


def camel_case_split(str):
    """Split camel case string to individual strings"""
    return re.findall(r"[A-Z](?:[a-z]+|[A-Z]*(?=[A-Z]|$))", str)


def get_current_user():
    """Get the current user from the context"""
    if context.get("user_obj"):
        return context["user_obj"]

    user = context.get("user")
    if user:
        context["user_obj"] = models.User.query.filter_by(external_id=user).first()
        return context["user_obj"]
    return None


# Sentinel value to distinguish between no argument and explicit None
_UNSET = object()


def is_user_admin(user=_UNSET):
    """Check if the user has the admin role

    Args:
        user: User object to check. If not provided, gets current user from context.
              If None is explicitly passed, returns False.

    Returns:
        bool: True if user has admin role, False otherwise
    """
    if user is _UNSET:
        # No argument provided, get current user from context
        user = get_current_user()
    return user_has_role(user, "admin")


def user_has_role(user, name):
    """Check if the user has the role called ``name``; False for no user."""
    if user is None:
        return False
    return name in _user_role_names(user)


def _user_role_names(user):
    """Return the user's role names, memoized per user id on the request."""
    user_identity = sa.inspect(user).identity
    if not user_identity:
        return frozenset()
    user_id = user_identity[0]

    try:
        request_cache = context.setdefault("user_role_names", {})
    except Exception:
        request_cache = {}
    if user_id in request_cache:
        return request_cache[user_id]

    # Load roles eagerly to avoid lazy loading when raise_on_sql is enabled.
    from sqlalchemy.orm import selectinload

    with db.session.no_autoflush:
        user_with_roles = db.session.scalar(
            sa.select(models.User)
            .options(selectinload(models.User.roles))
            .where(models.User.id == user_id)
        )

    role_names = frozenset(
        role.name for role in (user_with_roles.roles if user_with_roles else ())
    )

    request_cache[user_id] = role_names
    return role_names


def visibility_filters(entity):
    """What the current user may see of ``entity``'s rows: public ones and
    their own, or everything for an admin. ``entity`` has ``public`` and
    ``user_id`` columns."""
    current_user = get_current_user()
    if is_user_admin(current_user):
        return []
    owner = current_user.external_id if current_user else None
    # Column on the left: ParadeDB applies a filter written this way inside
    # its index scan, and `m.user == current_user` renders the other way round.
    return [sa.or_(entity.public.is_(True), entity.user_id == owner)]


def view_maker(cls):
    """Create a View class with model and schema attributes"""
    proc_name = cls.__name__.removesuffix("View").removesuffix("Resource")
    basename = singularize(
        proc_name,
        custom={
            "MetaAnalyses": "MetaAnalysis",
            "AnnotationAnalyses": "AnnotationAnalysis",
        },
    )

    class ClassView(cls):
        _model = getattr(models, basename)
        _schema = getattr(schemas, basename + "Schema")

    ClassView.__name__ = cls.__name__

    return ClassView


def validate_search_query(query: str) -> bool:
    """
    Validate a search query string.

    Args:
        query (str): The query string to validate.

    Returns:
        bool: True if the query is valid, False otherwise.
    """
    query = query.upper()

    # Check for valid parentheses
    if not validate_parentheses(query):
        raise errors.SyntaxError("Unmatched parentheses")

    # Check for valid query end
    if not validate_query_end(query):
        raise errors.SyntaxError("Query cannot end with an operator")

    if not validate_multiple_operators(query):
        raise errors.SyntaxError("Consecutive operators are not allowed")

    return True


def validate_parentheses(query: str) -> bool:
    """
    Validate the parentheses in a query string.

    Args:
        query (str): The query string to validate.

    Returns:
        bool: True if parentheses are valid, False otherwise.
    """
    stack = []
    for char in query:
        if char == "(":
            stack.append(char)
        elif char == ")":
            if not stack:
                return False  # Unmatched closing parenthesis
            stack.pop()
    return not stack  # Ensure all opening parentheses are closed


def validate_query_end(query: str) -> bool:
    """Query should not end with an operator"""
    operators = ("AND", "OR", "NOT", "&", "|", "&!")

    if query.strip().split(" ")[-1] in operators:
        return False
    return True


def validate_multiple_operators(query: str) -> bool:
    """Validate that there are no consecutive operators in a query."""
    operators = ("AND", "OR", "NOT", "&", "|", "&!")
    query = query.strip().split(" ")
    for i in range(len(query) - 1):
        if query[i] in operators and query[i + 1] in operators:
            return False
    return True


def count_chars(target, query: str) -> int:
    """Count the number of chars in a query string.
    Excluding those in quoted phrases."""
    count = 0
    in_quotes = False
    for char in query:
        if char == '"':
            in_quotes = not in_quotes
        if char == target and not in_quotes:
            count += 1
    return count


def process_group(group_query: str) -> str:
    """Process a group of tokens (with or without parentheses)

    Args:
        group_query (str): The query string to process.

    Returns:
        str: The processed query string with proper operators.
    """

    def parse_parentheses(text):
        """Parse text into a list of groups and terms"""
        groups = []
        current = []
        depth = 0
        buffer = ""

        for char in text:
            if char == "(":
                negated_group = False
                if depth == 0 and buffer:
                    pending = buffer.strip()
                    # A "-" immediately preceding a group negates the whole group
                    if pending.endswith("-"):
                        negated_group = True
                        pending = pending.rstrip("-").strip()
                    if pending:
                        current.append(pending)
                    buffer = ""
                depth += 1
                buffer += "-(" if negated_group else char
            elif char == ")":
                depth -= 1
                buffer += char
                if depth == 0:
                    current.append(buffer)
                    buffer = ""
            else:
                buffer += char

        if buffer:
            current.append(buffer.strip())

        for item in current:
            if item.startswith("(") and item.endswith(")"):
                # Recursively process nested groups
                inner = process_group(item[1:-1])
                if inner:
                    groups.append(f"({inner})")
            elif item.startswith("-(") and item.endswith(")"):
                # Negated group: -(a OR b)
                inner = process_group(item[2:-1])
                if inner:
                    groups.append(f"!({inner})")
            else:
                # Process non-group terms
                parts = re.findall(r'-?"[^"]*"|-?\'[^\']*\'|\S+', item)
                for part in parts:
                    part = part.strip()
                    if part:
                        # A leading "-" negates the term (PubMed-style NOT)
                        negate = False
                        if part.startswith("-"):
                            unsigned = part.lstrip("-").strip()
                            if not unsigned:
                                # A bare "-" carries no term to negate
                                continue
                            negate = True
                            part = unsigned
                        if part == "AND":
                            groups.append("&")
                        elif part == "OR":
                            groups.append("|")
                        elif part == "NOT":
                            groups.append("&!")
                        elif part.startswith('"') or part.startswith("'"):
                            words = re.findall(r"\w+", part)
                            if words:
                                phrase = "<->".join(words)
                                if negate:
                                    phrase = (
                                        f"!({phrase})" if len(words) > 1 else f"!{phrase}"
                                    )
                                groups.append(phrase)
                        else:
                            cleaned = re.sub(r"[\[\],;:!?@#]", "", part)
                            if cleaned:
                                groups.append(f"!{cleaned}" if negate else cleaned)

        infix_operators = {"&", "|", "&!"}
        result = []
        for i, term in enumerate(groups):
            if i > 0:
                prev = result[-1] if result else ""
                curr = term

                # Only add operator if neither current nor previous term is an operator
                if prev not in infix_operators and curr not in infix_operators:
                    result.append("&")
                elif prev in infix_operators and curr in infix_operators:
                    # Skip consecutive operators
                    continue

            result.append(term)

        # A group cannot open with an infix operator (e.g. a leading "NOT");
        # rewrite "&!" as the prefix negation "!" and drop a dangling "&"/"|".
        if result and result[0] in infix_operators:
            if result[0] == "&!":
                if len(result) > 1:
                    result = [f"!{result[1]}"] + result[2:]
                else:
                    result = []
            else:
                result = result[1:]

        return " ".join(result)

    return parse_parentheses(group_query)


def tsquery_has_positive_term(tsquery: str) -> bool:
    """Whether a tsquery has a term an index can narrow on.

    Postgres cannot use a GIN index to satisfy a negation, so a query made only
    of negations degrades to a sequential scan that matches nearly every row.
    """
    i = 0
    length = len(tsquery)

    def skip_group(start: int) -> int:
        depth = 0
        pos = start
        while pos < length:
            if tsquery[pos] == "(":
                depth += 1
            elif tsquery[pos] == ")":
                depth -= 1
                if depth == 0:
                    return pos + 1
            pos += 1
        return pos

    def skip_negated(start: int) -> int:
        pos = start
        while pos < length and tsquery[pos].isspace():
            pos += 1
        if pos < length and tsquery[pos] == "(":
            return skip_group(pos)
        while pos < length and not tsquery[pos].isspace():
            pos += 1
        return pos

    while i < length:
        char = tsquery[i]
        if char.isspace():
            i += 1
        elif char == "!":
            i = skip_negated(i + 1)
        elif char == "&" and tsquery[i : i + 2] == "&!":  # noqa: E203
            i = skip_negated(i + 2)
        elif char in "&|":
            i += 1
        elif char == "(":
            end = skip_group(i)
            if tsquery_has_positive_term(tsquery[i + 1 : end - 1]):  # noqa: E203
                return True
            i = end
        else:
            return True
    return False


def pubmed_to_tsquery(query: str) -> str:
    """
    Convert a PubMed-like search query to PostgreSQL tsquery format,
    grouping both single-quoted and double-quoted text with the <-> operator
    for proximity search.

    Additionally, automatically adds & between non-explicitly connected terms
    and handles NOT terms.

    Args:
        query (str): The search query.

    Returns:
        str: The PostgreSQL tsquery equivalent.
    """
    query = query.upper()  # Ensure uniformity
    result = process_group(query)

    return result


# Columns with no meaningful order, and the legacy full-text columns, which are
# large enough that sorting on them would be a scan of the whole text.
_UNSORTABLE_TYPES = (sa.JSON, TSVector, Vector, EncryptedText)
_UNSORTABLE_NAMES = {"ace_fulltext", "pubget_fulltext"}


def sortable_columns(model):
    """Names of the columns of ``model`` a client may sort (or take distinct values) by."""
    return {
        attr.key
        for attr in model.__mapper__.column_attrs
        if not isinstance(attr.columns[0].type, _UNSORTABLE_TYPES)
        and attr.key not in _UNSORTABLE_NAMES
    }


class TextMatch(NamedTuple):
    """How a text search narrows the query, the relevance keys it orders by
    (most significant first), and the key that breaks ties.

    ``paged``, when set, orders and pages the narrowed query itself, as
    ``paged(q, direction, page, per_page) -> (records, total)``; ``page`` None
    asks for every record.
    """

    narrow: Callable
    ranks: tuple
    tiebreak: sa.ColumnElement
    paged: Callable | None = None


def tsvector_search(ts_vector):
    """Text search on a tsvector column, ranked by ``ts_rank``."""

    def search(tsquery_string):
        tsquery = func.to_tsquery("english", tsquery_string)
        clause = ts_vector.op("@@")(tsquery)
        return TextMatch(
            lambda q: q.filter(clause),
            (func.ts_rank(ts_vector, tsquery),),
            ts_vector.class_.id,
        )

    return search


class _Boost(sa.types.UserDefinedType):
    """ParadeDB's ``pdb.boost(n)``: multiplies a clause's share of the BM25 score."""

    cache_ok = True

    def __init__(self, factor):
        self.factor = factor

    def get_col_spec(self, **kw):
        return f"pdb.boost({self.factor})"


# A tsquery string's tokens: operators, parentheses, and words, where a word
# runs up to whitespace, an operator or a parenthesis.
_TSQUERY_TOKEN = re.compile(r"<->|&!|[&|!()]|(?:(?!<->)[^\s&|!()])+")


def bm25_clause(tsquery_string, fields):
    """The clause matching a tsquery string on BM25-indexed ``fields``, pairs of
    an indexed column and its boost, or None when the query has no words.

    Every word or phrase must occur in one of the fields, as a phrase of its
    tokens (so ``5-HT`` is ``5`` followed by ``ht``); the score adds up each
    field's match times its boost. A word or phrase made only of English stop
    words is left out, as to_tsquery leaves it out.
    """

    def match(words):
        text = " ".join(words)
        clause = sa.or_(
            *(
                column.op("###", is_comparison=True)(
                    sa.cast(sa.literal(text), _Boost(boost))
                )
                for column, boost in fields
            )
        )
        # Left out like a stop word or a word with no letters or digits:
        # Postgres's own dictionary decides, and the planner evaluates this
        # constant before ParadeDB reads the query.
        stop = func.to_tsvector("english", text) == ""
        return _Operand(clause, stop)

    query = _parse_tsquery(_TSQUERY_TOKEN.findall(tsquery_string), match)
    if query is None:
        return None
    return sa.case((query.stop, sa.false()), else_=query.clause)


def bm25_search(key, fields):
    """Text search on a ParadeDB BM25 index, ranked by its score.

    Ties are broken by the hash of ``key`` that the index holds, so the index
    returns the page itself.
    """

    def search(tsquery_string):
        clause = bm25_clause(tsquery_string, fields)
        clause = sa.false() if clause is None else clause
        return TextMatch(
            lambda q: q.filter(clause),
            (func.pdb.score(key),),
            func.hashtextextended(key, 0),
        )

    return search


_TSQUERY_OPERATORS = {"&", "&!", "|", "!", "(", ")", "<->"}


class _Operand(NamedTuple):
    """A clause, and the constant condition under which it is left out."""

    clause: sa.ColumnElement
    stop: sa.ColumnElement


def _parse_tsquery(tokens, match):
    """Build a clause from a tsquery string's tokens, with tsquery's precedence
    (``!`` binds tightest, then ``<->``, ``&``, ``|``). ``match`` makes the clause
    for one word or phrase as an ``_Operand``; None stands for an operand with
    no words. Both are left out, as to_tsquery leaves out a word with no
    lexemes: an operand whose ``stop`` holds counts as true under AND and as
    false under OR."""
    pos = 0

    def peek(offset=0):
        return tokens[pos + offset] if pos + offset < len(tokens) else None

    def take():
        nonlocal pos
        pos += 1
        return tokens[pos - 1]

    def is_word(token):
        return token is not None and token not in _TSQUERY_OPERATORS

    def combine(operator, left_out, operands):
        operands = [o for o in operands if o is not None]
        if not operands:
            return None
        if len(operands) == 1:
            return operands[0]
        return _Operand(
            operator(*(sa.case((o.stop, left_out), else_=o.clause) for o in operands)),
            sa.and_(*(o.stop for o in operands)),
        )

    def negate(operand):
        if operand is None:
            return None
        return _Operand(sa.not_(operand.clause), operand.stop)

    def any_of():
        operands = [all_of()]
        while peek() == "|":
            take()
            operands.append(all_of())
        return combine(sa.or_, sa.false(), operands)

    def all_of():
        operands = [negation()]
        # A <-> that does not join two words joins nothing, so it reads as AND.
        while peek() in ("&", "&!", "<->"):
            negated = take() == "&!"
            operand = negation()
            operands.append(negate(operand) if negated else operand)
        return combine(sa.and_, sa.true(), operands)

    def negation():
        if peek() == "!":
            take()
            return negate(negation())
        return phrase()

    def phrase():
        if peek() == "(":
            take()
            group = any_of()
            take()  # ")"
            return group
        if not is_word(peek()):
            return None
        words = [take()]
        while peek() == "<->" and is_word(peek(1)):
            take()
            words.append(take())
        return match(words)

    return any_of()


def apply_search_predicate(q, search, field_filters, *, text_search, pmid_match):
    """Narrow ``q`` by a ``search`` string and per-column ILIKE filters.

    ``text_search`` maps the search, as a tsquery string, to a ``TextMatch``
    (see ``tsvector_search`` and ``bm25_search``), or is None when the model
    has no text search (a non-numeric ``search`` is then ignored).
    ``pmid_match`` is the clause an all-digits ``search`` must satisfy, or None
    when the model has no pmid (such a search is then ignored).
    ``field_filters`` maps columns to the substring each must contain; None
    values are skipped.

    Returns ``(q, text_match)``; ``text_match`` is the ``TextMatch`` when a
    text search was applied, else None.
    """
    text_match = None

    # temporary fix for pmid search
    if search is not None and search.isdigit():
        if pmid_match is not None:
            q = q.filter(pmid_match)
    elif search is not None and text_search is not None:
        try:
            validate_search_query(search)
        except errors.SyntaxError as e:
            abort_validation(e.args[0])
        tsquery_string = pubmed_to_tsquery(search)
        if not tsquery_has_positive_term(tsquery_string):
            # No index narrows on a negation, so this would read and return
            # nearly the whole corpus.
            abort_validation(
                "A search must include at least one term to match; a query "
                "of only negations matches nearly every record."
            )
        text_match = text_search(tsquery_string)
        q = text_match.narrow(q)

    for column, value in field_filters.items():
        if value is not None:
            q = q.filter(column.ilike(f"%{value}%"))

    return q, text_match

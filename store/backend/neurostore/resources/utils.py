"""
Resource-specific utilities for View construction and function
"""

import re

import sqlalchemy as sa
from connexion.context import context
from psycopg2 import errors

from neurostore import models, schemas
from neurostore.database import db
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

    if user is None:
        return False

    # Fast-path: memoized on request context or user instance
    try:
        cached = context.get("is_admin")
        if cached is not None:
            return cached
    except Exception:
        cached = None

    cached = getattr(user, "_is_admin", None)
    if cached is not None:
        return cached

    # Load roles eagerly to avoid lazy loading when raise_on_sql is enabled.
    from sqlalchemy.orm import selectinload

    user_identity = sa.inspect(user).identity
    if not user_identity:
        return False

    with db.session.no_autoflush:
        user_with_roles = db.session.scalar(
            sa.select(models.User)
            .options(selectinload(models.User.roles))
            .where(models.User.id == user_identity[0])
        )

    if user_with_roles is None:
        is_admin = False
    else:
        is_admin = any(role.name == "admin" for role in user_with_roles.roles)

    # Memoize for the remainder of the request and on the user instance
    try:
        context["is_admin"] = is_admin
    except Exception:
        pass
    try:
        setattr(user, "_is_admin", is_admin)
    except Exception:
        pass

    return is_admin


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
        elif char == "&" and tsquery[i : i + 2] == "&!":
            i = skip_negated(i + 2)
        elif char in "&|":
            i += 1
        elif char == "(":
            end = skip_group(i)
            if tsquery_has_positive_term(tsquery[i + 1 : end - 1]):
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

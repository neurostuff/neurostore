"""
Resource-specific utilities for View construction and function
"""

import re

from connexion.context import context
from psycopg2 import errors

from .. import models
from .. import schemas
from .singular import singularize


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

    # Load roles eagerly to avoid lazy loading when raise_on_sql is enabled.
    from sqlalchemy.orm import selectinload

    if user.id is None:
        return False

    user_with_roles = (
        models.User.query.options(selectinload(models.User.roles))
        .filter_by(id=user.id)
        .first()
    )

    if user_with_roles is None:
        return False

    return any(role.name == "admin" for role in user_with_roles.roles)


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
                if depth == 0 and buffer:
                    current.append(buffer.strip())
                    buffer = ""
                depth += 1
                buffer += char
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
            else:
                # Process non-group terms
                parts = re.findall(r'"[^"]*"|\'[^\']*\'|\S+', item)
                for part in parts:
                    part = part.strip()
                    if part:
                        if part == "AND":
                            groups.append("&")
                        elif part == "OR":
                            groups.append("|")
                        elif part == "NOT":
                            groups.append("&!")
                        elif part.startswith('"') or part.startswith("'"):
                            words = re.findall(r"\w+", part)
                            if words:
                                groups.append("<->".join(words))
                        else:
                            cleaned = re.sub(r"[\[\],;:!?@#]", "", part)
                            if cleaned:
                                groups.append(cleaned)

        result = []
        for i, term in enumerate(groups):
            if i > 0:
                prev = result[-1] if result else ""
                curr = term

                # Only add operator if neither current nor previous term is an operator
                if prev not in {"&", "|", "&!"} and curr not in {"&", "|", "&!"}:
                    result.append("&")
                elif prev in {"&", "|", "&!"} and curr in {"&", "|", "&!"}:
                    # Skip consecutive operators
                    continue

            result.append(term)

        return " ".join(result)

    return parse_parentheses(group_query)


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

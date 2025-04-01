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
    operators = ("AND", "OR", "NOT")

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

    # Step 1: Split into tokens (preserving quoted phrases)
    # Regex pattern: match quoted phrases or non-space sequences
    tokens = re.findall(r'"[^"]*"|\'[^\']*\'|\S+', query)

    # Step 2: Combine tokens in parantheses into single tokens
    def combine_parentheses(tokens: list) -> list:
        """
        Combine tokens within parentheses into a single token.

        Args:
            tokens (list): List of tokens to process.

        Returns:
            list: Processed list with tokens inside parentheses combined.
        """
        combined_tokens = []
        buffer = []
        paren_count = 0
        for token in tokens:
            # If buffer is not empty, we are inside parentheses
            if len(buffer) > 0:
                buffer.append(token)

                # Adjust the count of parentheses
                paren_count += count_chars("(", token) - count_chars(")", token)

                if paren_count < 1:
                    # Combine all tokens in parentheses
                    combined_tokens.append(" ".join(buffer))
                    buffer = []  # Clear the buffer
                    paren_count = 0

            else:
                n_paren = count_chars("(", token) - count_chars(")", token)
                # If not in parentheses, but token contains opening parentheses
                # Start capturing tokens inside parentheses
                if token[0] == "(" and n_paren > 0:
                    paren_count += n_paren
                    buffer.append(token)  # Start capturing tokens in parens
                    print(buffer)
                else:
                    combined_tokens.append(token)

        # If the list ends without a closing parenthesis (invalid input)
        # append buffer contents (fallback)
        if buffer:
            combined_tokens.append(" ".join(buffer))

        return combined_tokens

    tokens = combine_parentheses(tokens)
    print(tokens)
    for i, token in enumerate(tokens):
        if token[0] == "(" and token[-1] == ")":
            # RECURSIVE: Process the contents of the parentheses
            token_res = pubmed_to_tsquery(token[1:-1])
            token = "(" + token_res + ")"
            tokens[i] = token

        # Step 4: Handle both single-quoted and double-quoted phrases,
        # grouping them with <-> (proximity operator)
        elif token[0] in ('"', "'"):
            # Split quoted text into individual words and join with <-> for
            # proximity search
            words = re.findall(r"\w+", token)
            tokens[i] = "<->".join(words)

        # Step 3: Replace logical operators AND, OR, NOT
        else:
            if token == "AND":
                tokens[i] = "&"
            elif token == "OR":
                tokens[i] = "|"
            elif token == "NOT":
                tokens[i] = "&!"

    processed_tokens = []
    last_token = None
    for token in tokens:
        # Step 5: Add & between consecutive terms that aren't already
        # connected by an operator
        stripped_token = token.strip()
        if stripped_token not in ("&", "|", "!", "&!"):
            stripped_token = re.sub(r"[\[\],;:!?@#]", "", stripped_token)
        if stripped_token == "":
            continue  # Ignore empty tokens from splitting

        if last_token and last_token not in ("&", "|", "!", "&!"):
            if stripped_token not in ("&", "|", "!", "&!"):
                # Insert an implicit AND (&) between two non-operator tokens
                processed_tokens.append("&")

        processed_tokens.append(stripped_token)
        last_token = stripped_token

    return " ".join(processed_tokens)

"""
Utilities for View construction and function
"""

import re

from connexion.context import context
from psycopg2 import errors
from sqlalchemy import (
    cast,
    String,
    Integer,
    Float,
    Boolean,
    ARRAY,
    text,
    or_,
    and_,
    func,
    select,
)
from sqlalchemy.orm import aliased

from ..database import db
from .. import models
from .. import schemas
from .singular import singularize


# https://www.geeksforgeeks.org/python-split-camelcase-string-to-individual-strings/
def camel_case_split(str):
    return re.findall(r"[A-Z](?:[a-z]+|[A-Z]*(?=[A-Z]|$))", str)


def get_current_user():
    if context.get("user_obj"):
        return context["user_obj"]

    user = context.get("user")
    if user:
        context["user_obj"] = models.User.query.filter_by(external_id=user).first()
        return context["user_obj"]
    return None


def view_maker(cls):
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


def validate_pipeline_filter(filter_spec):
    """Validate pipeline filter format and return components.
    
    Args:
        filter_spec (str): Filter specification in format "PipelineName:path.to.field=value"
        
    Returns:
        tuple: (pipeline_name, field_path, operator, value)
        
    Raises:
        ValidationError: If filter format is invalid
    """
    from webargs import ValidationError
    
    if ":" not in filter_spec:
        raise ValidationError("Missing pipeline name in filter")
        
    pipeline_name, rest = filter_spec.split(":", 1)
    
    if not pipeline_name:
        raise ValidationError("Empty pipeline name in filter")
        
    if ".." in rest:
        raise ValidationError("Contains consecutive dots")
        
    if "[[" in rest or "]]" in rest:
        raise ValidationError("Invalid path segment")
        
    pattern = r"(<=|>=|<|>|=|~|!=|\[\])"
    match = re.search(pattern, rest)
    if not match:
        raise ValidationError("Invalid filter format")
        
    operator = match.group(0)
    path, value = rest.split(operator, 1)
    
    if not path or not value:
        raise ValidationError("Empty path or value in filter")
        
    # Try to parse numeric values
    if operator in ('>', '<', '>=', '<='):
        try:
            float(value)
        except ValueError:
            raise ValidationError(f"Invalid numeric value '{value}'")
            
    return pipeline_name, path, operator, value

def parse_filter_value(value):
    """Parse filter values to detect operators and handle multiple conditions."""
    operators = [">=", "<=", "!=", ">", "<", "~"]

    if "|" in value:  # OR condition
        return "|", [parse_filter_value(v.strip())[1] for v in value.split("|")]

    if "&" in value:  # AND condition
        return "&", [parse_filter_value(v.strip())[1] for v in value.split("&")]

    for op in operators:
        if value.startswith(op):
            return op, value[len(op):]

    if "," in value:  # IN condition
        return "IN", value.split(",")

    if value.lower() in ["true", "false"]:  # Boolean
        return "=", value.lower() == "true"

    return "=", value  # Default case


def determine_cast_type(value):
    """Determine whether to cast as STRING, INTEGER, FLOAT, or BOOLEAN."""
    if isinstance(value, bool):
        return Boolean

    if isinstance(value, list):  # For IN queries
        value = value[0] if value else ""

    if value.replace(".", "", 1).isdigit():
        return Float if "." in value else Integer

    return String


def build_jsonb_filter(query, filters):
    """
    Converts deeply nested JSON filters into SQLAlchemy filter expressions.
    Supports:
      - Nested JSONB paths (info.user.name)
      - Multiple OR values (info.user.name=John,Sally)
      - Range queries (info.user.age>=30)
      - LIKE queries (info.user.name~Jo for "LIKE 'Jo%'")
      - Boolean filtering (info.user.active=true)
      - Array containment (@?) for array fields
      - OR conditions with array values (modality=[EEG|fMRI])
      - Proper type casting for numeric comparisons
    """

    parts = filters.split(".", 1)
    pipeline_name = parts[0] 
    keys = parts[1].split(".") if len(parts) > 1 else []

    pattern = r"(<=|>=|<|>|=|~|!=|\[\])"

    # Extract the last key
    if keys:
        last_key_value = keys[-1]
        match = re.search(pattern, last_key_value)
        if match:
            operator = match.group(0)
            last_key, value = last_key_value.split(operator, 1)
            # Handle array operator
            if operator == "[]":
                operator = "@?"
        else:
            operator = None
            value = last_key_value
    else:
        operator = None
        value = None

    if len(keys) > 1:
        keys[-1] = last_key

    # Create the aliases
    PipelineStudyResultAlias = aliased(models.PipelineStudyResult)
    PipelineConfigAlias = aliased(models.PipelineConfig)
    PipelineAlias = aliased(models.Pipeline)

    # Determine the type for casting
    cast_type = determine_cast_type(value)

    # Parse the value for possible OR conditions
    op, parsed_value = parse_filter_value(value) if value else ("=", None)

    # Build the jsonpath query based on operator type
    if operator == "@?":
        # Array containment - handle OR conditions
        if isinstance(parsed_value, list):
            # Multiple values with OR
            conditions = []
            for val in parsed_value:
                if cast_type in (Integer, Float):
                    conditions.append(f"@ == {val}")
                else:
                    conditions.append(f"@ == '{val}'")
            array_condition = " || ".join(conditions)
            jsonpath_query = f"strict $.{'.'.join(keys[:-1])}[*] ? ({array_condition})"
        else:
            # Single value
            if cast_type in (Integer, Float):
                jsonpath_query = f"strict $.{'.'.join(keys[:-1])}[*] ? (@ == {parsed_value})"
            else:
                jsonpath_query = f"strict $.{'.'.join(keys[:-1])}[*] ? (@ == '{parsed_value}')"
    
    elif operator == "~":
        # Text search
        jsonpath_query = f"strict $.{'.'.join(keys)} ? (@ like_regex '{parsed_value}')"
    
    elif operator == "=":
        # Equality with type casting
        if cast_type in (Integer, Float):
            jsonpath_query = f"strict $.{'.'.join(keys)} ? (@ == {parsed_value})"
        else:
            jsonpath_query = f"strict $.{'.'.join(keys)} ? (@ == '{parsed_value}')"
    
    else:
        # Other comparisons with type casting
        if cast_type in (Integer, Float):
            jsonpath_query = f"strict $.{'.'.join(keys)} ? (@ {operator} {parsed_value})"
        else:
            jsonpath_query = f"strict $.{'.'.join(keys)} ? (@ {operator} '{parsed_value}')"

    if jsonpath_query:
        # Join the necessary tables
        query = query.outerjoin(
            PipelineStudyResultAlias,
            models.BaseStudy.id == PipelineStudyResultAlias.base_study_id,
        )
        query = query.outerjoin(
            PipelineConfigAlias,
            PipelineStudyResultAlias.config_id == PipelineConfigAlias.id,
        )
        query = query.outerjoin(PipelineAlias, PipelineAlias.id == PipelineConfigAlias.pipeline_id)

        query = query.filter(PipelineAlias.name == pipeline_name)

        # Subquery to get the most recent PipelineStudyResult for each base_study
        subquery = (
            db.session.query(
                PipelineStudyResultAlias.base_study_id,
                func.max(PipelineStudyResultAlias.date_executed).label(
                    "max_date_executed"
                ),
            )
            .group_by(PipelineStudyResultAlias.base_study_id)
            .subquery()
        )

        # Only filter based on the most recently run results
        query = query.join(
            subquery,
            (PipelineStudyResultAlias.base_study_id == subquery.c.base_study_id)
            & (PipelineStudyResultAlias.date_executed == subquery.c.max_date_executed),
        )

        query = query.filter(
            func.jsonb_path_exists(PipelineStudyResultAlias.result_data, jsonpath_query)
        )

    return query

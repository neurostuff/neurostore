import pytest

from neurostore.resources.utils import (
    pubmed_to_tsquery,
    tsquery_has_positive_term,
    validate_search_query,
)
from neurostore.tests.conftest import (
    negation_only_queries,
    valid_queries,
    validate_queries,
    weird_queries,
)


@pytest.mark.parametrize("query, expected", valid_queries)
def test_pubmed_to_tsquery(query, expected):
    assert pubmed_to_tsquery(query) == expected


@pytest.mark.parametrize("query, expected", validate_queries)
def test_validate_search_query(query, expected):
    if expected is True:
        assert validate_search_query(query) == expected
    else:
        with pytest.raises(Exception):
            validate_search_query(query)


@pytest.mark.parametrize("query, expected", weird_queries)
def test_pubmed_to_tsquery_weird(query, expected):
    assert pubmed_to_tsquery(query) == expected


@pytest.mark.parametrize(
    "query, expected",
    [
        ("SMOKING & !MARIJUANA", True),
        ("SMOKING &! MARIJUANA", True),
        ("(SMOKING | VAPING) & !MARIJUANA", True),
        ("TOBACCO & !(SMOKING | VAPING)", True),
        ("SMOKING", True),
        ("MILD<->COGNITIVE<->IMPAIRMENT", True),
        ("!MARIJUANA", False),
        ("!(MEDICAL<->MARIJUANA)", False),
        ("!MARIJUANA | !CANNABIS", False),
        ("!MARIJUANA & !CANNABIS", False),
        ("!(SMOKING | VAPING)", False),
        ("!A &! B", False),
        ("", False),
    ],
)
def test_tsquery_has_positive_term(query, expected):
    assert tsquery_has_positive_term(query) is expected


@pytest.mark.parametrize("query, expected", negation_only_queries)
def test_negation_only_queries_still_convert(query, expected):
    """Conversion is correct; it is the endpoint that refuses to run these."""
    assert pubmed_to_tsquery(query) == expected
    assert tsquery_has_positive_term(expected) is False

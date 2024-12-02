import pytest

from ..resources.utils import pubmed_to_tsquery, validate_search_query
from .conftest import valid_queries, validate_queries, weird_queries


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

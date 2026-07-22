from neurostore.database import NeurostoreQuery
from neurostore.models import BaseStudy


def test_model_query_provides_flask_sqlalchemy_compatible_pagination(db):
    page = BaseStudy.query.paginate(page=1, per_page=10, error_out=False)

    assert isinstance(BaseStudy.query, NeurostoreQuery)
    assert page.total >= len(page.items)
    assert page.pages >= 0
    assert page.has_prev is False
    assert page.has_next is (page.total > page.per_page)

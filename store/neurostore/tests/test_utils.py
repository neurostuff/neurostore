import pytest

from ..utils import search_to_tsquery, validate_search_query


invalid_queries = [
    ('("autism" OR "ASD" OR "autistic") AND (("decision*" OR "choice*" ', 'Unmatched parentheses'),
    ('"autism" OR "ASD" OR "autistic" OR ', 'Query cannot end with an operator'),
    ('(("Autism Spectrum Disorder" OR "autism spectrum disorder") OR ("Autism" OR "autism") OR ("ASD")) AND (("decision*" OR "Dec', 'Unmatched parentheses')
]

valid_queries = [
    ('"Mild Cognitive Impairment" or "Early Cognitive Decline" or "Pre-Dementia" or "Mild Neurocognitive Disorder"', 
     'MILD<->COGNITIVE<->IMPAIRMENT | EARLY<->COGNITIVE<->DECLINE | PRE<->DEMENTIA | MILD<->NEUROCOGNITIVE<->DISORDER'),
    ('("autism" OR "ASD" OR "autistic") AND ("decision" OR "choice")',
     '(AUTISM | ASD | AUTISTIC) & (DECISION | CHOICE)'),
    ('stroop and depression or back and depression or go',
     'STROOP & DEPRESSION | BACK & DEPRESSION | GO'),
    ('("autism" OR "ASD" OR "autistic") AND (("decision" OR "decision-making" OR "choice" OR "selection" OR "option" OR "value") OR ("feedback" OR "feedback-related" OR "reward" OR "error" OR "outcome" OR "punishment" OR "reinforcement"))',
     '(AUTISM | ASD | AUTISTIC) & ((DECISION | DECISION<->MAKING | CHOICE | SELECTION | OPTION | VALUE) | (FEEDBACK | FEEDBACK<->RELATED | REWARD | ERROR | OUTCOME | PUNISHMENT | REINFORCEMENT))'),
    ('"dyslexia" or "Reading Disorder" or "Language-Based Learning Disability" or "Phonological Processing Disorder" or "Word Blindness"',
     'DYSLEXIA | READING<->DISORDER | LANGUAGE<->BASED<->LEARNING<->DISABILITY | PHONOLOGICAL<->PROCESSING<->DISORDER | WORD<->BLINDNESS'),
    ('emotion and pain -physical -touch',
     'EMOTION & PAIN & -PHYSICAL & -TOUCH'),
    ('("Schizophrenia"[Mesh] OR schizophrenia )',
     '(SCHIZOPHRENIA & [MESH] | SCHIZOPHRENIA)')
    ('Bipolar Disorder',
     'BIPOLAR & DISORDER'),
    ('"quchi" or "LI11"',
     'QUCHI | LI11'),
    ('"rubber hand illusion"',
     'RUBBER<->HAND<->ILLUSION'),
]

error_queries = [
    "[Major Depressive Disorder (MDD)] or [Clinical Depression] or [Unipolar Depression]"
]

validate_queries = invalid_queries + [(q, True) for q, _ in valid_queries]


@pytest.mark.parametrize("query, expected", valid_queries)
def test_search_to_tsquery(query, expected):
    assert search_to_tsquery(query) == expected


@pytest.mark.parametrize("query, expected", invalid_queries)
def test_validate_search_query(query, expected):
    assert validate_search_query(query) == expected

@pytest.mark.parametrize("query", error_queries)
def test_search_to_tsquery_error(query):
    with pytest.raises(ValueError):
        search_to_tsquery(query)

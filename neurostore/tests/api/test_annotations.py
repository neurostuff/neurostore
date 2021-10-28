from ...models.data import Dataset, Annotation


def test_post_annotation(auth_client, ingest_neurosynth):
    dset = Dataset.query.first()
    # y for x in non_flat for y in x
    data = [{'study': s.id, 'analysis': a.id, 'note': {'foo': a.id}} for s in dset.studies for a in s.analyses]
    payload = {'dataset': dset.id, 'notes': data, 'name': 'mah notes'}
    auth_client.post('/api/annotations/', data=payload)

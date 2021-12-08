from ...models.data import Dataset


def test_post_annotation(auth_client, ingest_neurosynth):
    dset = Dataset.query.first()
    # y for x in non_flat for y in x
    data = [
        {'study': s.id, 'analysis': a.id, 'note': {'foo': a.id}}
        for s in dset.studies for a in s.analyses
    ]
    payload = {'dataset': dset.id, 'notes': data, 'name': 'mah notes'}
    resp = auth_client.post('/api/annotations/', data=payload)
    assert resp.status_code == 200


def test_get_annotations(auth_client, ingest_neurosynth):
    dset = Dataset.query.first()
    resp = auth_client.get(f'/api/annotations/?dataset_id={dset.id}')
    assert resp.status_code == 200


def test_clone_annotation(auth_client, simple_neurosynth_annotation):
    annotation_entry = simple_neurosynth_annotation
    resp = auth_client.post(f"/api/annotations/?source_id={annotation_entry.id}", data={})
    assert resp.status_code == 200
    data = resp.json
    assert data['name'] == annotation_entry.name
    assert data['source_id'] == annotation_entry.id
    assert data['source'] == 'neurostore'

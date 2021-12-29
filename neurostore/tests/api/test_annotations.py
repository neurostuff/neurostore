from ...models import Dataset, User


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
    import pandas as pd
    from io import StringIO

    dset = Dataset.query.first()
    resp = auth_client.get(f'/api/annotations/?dataset_id={dset.id}')
    assert resp.status_code == 200

    annot_id = resp.json['results'][0]['id']

    annot = auth_client.get(f"/api/annotations/{annot_id}")
    assert annot.status_code == 200

    annot_export = auth_client.get(f"/api/annotations/{annot_id}?export=true")

    assert annot_export.status_code == 200

    df = pd.read_csv(StringIO(annot_export.json['annotation']))

    assert isinstance(df, pd.DataFrame)


def test_clone_annotation(auth_client, simple_neurosynth_annotation):
    annotation_entry = simple_neurosynth_annotation
    resp = auth_client.post(f"/api/annotations/?source_id={annotation_entry.id}", data={})
    assert resp.status_code == 200
    data = resp.json
    assert data['name'] == annotation_entry.name
    assert data['source_id'] == annotation_entry.id
    assert data['source'] == 'neurostore'


def test_single_analysis_delete(auth_client, user_data):
    user = User.query.filter_by(name="user1").first()
    # get relevant dataset
    datasets = auth_client.get(f"/api/datasets/?user_id={user.external_id}")
    dataset_id = datasets.json['results'][0]['id']
    dataset = auth_client.get(f"/api/datasets/{dataset_id}")
    # get relevant annotation
    annotations = auth_client.get(f"/api/annotations/?dataset_id={dataset_id}")
    annotation_id = annotations.json['results'][0]['id']
    annotation = auth_client.get(f"/api/annotations/{annotation_id}")
    # pick study to edit
    study_id = dataset.json['studies'][0]
    study = auth_client.get(f"/api/studies/{study_id}")

    # select analysis to delete
    analysis_id = study.json['analyses'][0]
    auth_client.delete(f"/api/analyses/{analysis_id}")

    # test if annotations were updated
    updated_annotation = auth_client.get(f"/api/annotations/{annotation_id}")

    assert updated_annotation.status_code == 200
    assert (len(annotation.json['notes']) - 1) == (len(updated_annotation.json['notes']))

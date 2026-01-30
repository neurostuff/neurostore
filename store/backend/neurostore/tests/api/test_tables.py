from ...models import Study, Table, User


def _assign_user_to_study_tree(study, user):
    study.user = user
    for table in study.tables:
        table.user = user
    for analysis in study.analyses:
        analysis.user = user


def test_study_tables_are_ids_only(auth_client, ingest_neurosynth, session):
    study = Study.query.first()
    user = User.query.filter_by(external_id=auth_client.username).first()
    _assign_user_to_study_tree(study, user)
    session.commit()

    resp = auth_client.get(f"/api/studies/{study.id}?nested=false")
    assert resp.status_code == 200
    tables = resp.json()["tables"]
    assert all(isinstance(t, str) for t in tables)
    assert set(tables) == {t.id for t in study.tables}

    nested_resp = auth_client.get(f"/api/studies/{study.id}?nested=true")
    assert nested_resp.status_code == 200
    assert set(nested_resp.json()["tables"]) == set(tables)


def test_tables_endpoint_lists_analyses(auth_client, ingest_neurosynth, session):
    table = Table.query.first()
    user = User.query.filter_by(external_id=auth_client.username).first()
    _assign_user_to_study_tree(table.study, user)
    table.user = user
    session.commit()

    resp = auth_client.get(f"/api/tables/{table.id}?nested=false")
    assert resp.status_code == 200
    assert all(isinstance(a, str) for a in resp.json()["analyses"])

    nested_resp = auth_client.get(f"/api/tables/{table.id}?nested=true")
    assert nested_resp.status_code == 200
    nested_ids = {a["id"] for a in nested_resp.json()["analyses"]}
    assert nested_ids == {a.id for a in table.analyses}


def test_table_t_id_uniqueness_per_study(auth_client, ingest_neurosynth, session):
    study = Study.query.first()
    user = User.query.filter_by(external_id=auth_client.username).first()
    _assign_user_to_study_tree(study, user)
    session.commit()

    payload = {"study": study.id, "t_id": "unique-table", "name": "New Table"}
    resp = auth_client.post("/api/tables/", data=payload)
    assert resp.status_code == 200

    duplicate = auth_client.post("/api/tables/", data=payload)
    assert duplicate.status_code == 422


def test_analysis_requires_table_from_same_study(
    auth_client, ingest_neurosynth, session
):
    studies = Study.query.limit(2).all()
    assert len(studies) >= 2
    user = User.query.filter_by(external_id=auth_client.username).first()
    for study in studies:
        _assign_user_to_study_tree(study, user)
    session.commit()

    analysis = studies[0].analyses[0]
    valid_table = studies[0].tables[0]
    other_table = studies[1].tables[0]

    ok_resp = auth_client.put(
        f"/api/analyses/{analysis.id}", data={"table_id": valid_table.id}
    )
    assert ok_resp.status_code == 200
    assert ok_resp.json()["table_id"] == valid_table.id

    bad_resp = auth_client.put(
        f"/api/analyses/{analysis.id}", data={"table_id": other_table.id}
    )
    assert bad_resp.status_code == 422


def test_table_label_field(auth_client, ingest_neurosynth, session):
    """Test that table_label field can be set and retrieved."""
    study = Study.query.first()
    user = User.query.filter_by(external_id=auth_client.username).first()
    _assign_user_to_study_tree(study, user)
    session.commit()

    # Create a new table with table_label
    payload = {
        "study": study.id,
        "t_id": "test-table-001",
        "name": "n-back task contrasts",
        "table_label": "Table 1",
    }
    resp = auth_client.post("/api/tables/", data=payload)
    assert resp.status_code == 200
    assert resp.json()["table_label"] == "Table 1"
    assert resp.json()["name"] == "n-back task contrasts"
    assert resp.json()["t_id"] == "test-table-001"

    # Retrieve the table and verify table_label is present
    table_id = resp.json()["id"]
    get_resp = auth_client.get(f"/api/tables/{table_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["table_label"] == "Table 1"

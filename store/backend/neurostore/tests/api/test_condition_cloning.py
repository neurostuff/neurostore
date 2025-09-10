import pytest

from ...models import Study, Analysis, Condition, AnalysisConditions


def test_condition_cloning_via_api(auth_client, ingest_neurosynth, session):
    """
    Integration test to verify condition cloning preserves original references via API.
    This test validates the complete end-to-end behavior.
    """
    # Find a study with conditions
    study_with_conditions = None
    original_conditions = []

    for study in Study.query.all():
        for analysis in study.analyses:
            if analysis.analysis_conditions:
                study_with_conditions = study
                original_conditions = [
                    ac.condition for ac in analysis.analysis_conditions
                ]
                break
        if study_with_conditions:
            break

    if not study_with_conditions:
        pytest.skip("No study with conditions found")

    # Count total conditions before cloning
    total_conditions_before = Condition.query.count()

    # Clone the study via API
    resp = auth_client.post(f"/api/studies/?source_id={study_with_conditions.id}", data={})
    assert resp.status_code == 200

    cloned_study_data = resp.json()
    cloned_study_id = cloned_study_data["id"]

    # Count total conditions after cloning
    total_conditions_after = Condition.query.count()

    # Get the cloned study from database
    cloned_study = Study.query.filter_by(id=cloned_study_id).first()
    assert cloned_study is not None

    # Check conditions in the cloned study
    cloned_conditions = []
    for analysis in cloned_study.analyses:
        for ac in analysis.analysis_conditions:
            cloned_conditions.append(ac.condition)

    # The requirement: conditions should NOT be cloned, they should reference originals
    for orig_cond in original_conditions:
        # Find corresponding condition in cloned study by name
        matching_cloned_cond = next(
            (c for c in cloned_conditions if c.name == orig_cond.name), None
        )
        assert matching_cloned_cond is not None, (
            f"No matching condition found for {orig_cond.name}"
        )

        # THIS IS THE KEY TEST: The condition IDs should be the same (not cloned)
        assert matching_cloned_cond.id == orig_cond.id, (
            f"Condition was cloned! Original ID: {orig_cond.id}, "
            f"Cloned ID: {matching_cloned_cond.id}, Name: {orig_cond.name}"
        )

    # Conditions should not increase in the database
    assert total_conditions_after == total_conditions_before, (
        f"Condition count increased from {total_conditions_before} to {total_conditions_after}. "
        "Conditions should not be cloned!"
    )


def test_condition_cloning_creates_own_test_data(auth_client, session):
    """
    Integration test to verify condition cloning with self-created test data.
    This test creates its own data instead of relying on fixtures.
    """
    # Get the authenticated user ID from the client
    user_id = auth_client.username  # auth_client has username attribute

    # Create test condition
    test_condition = Condition(
        name="Test Condition", description="A test condition", user_id=user_id
    )
    session.add(test_condition)
    session.flush()  # Get the ID

    # Create test study with the same user
    test_study = Study(name="Test Study", description="A test study", user_id=user_id)
    session.add(test_study)
    session.flush()  # Get the ID

    # Create test analysis with the same user
    test_analysis = Analysis(name="Test Analysis", study_id=test_study.id, user_id=user_id)
    session.add(test_analysis)
    session.flush()  # Get the ID

    # Link analysis to condition
    analysis_condition = AnalysisConditions(
        analysis_id=test_analysis.id,
        condition_id=test_condition.id,
        weight=1.0
    )
    session.add(analysis_condition)
    session.commit()

    # Count conditions before cloning
    conditions_before = Condition.query.count()

    # Clone the study using the API
    resp = auth_client.post(f"/api/studies/?source_id={test_study.id}", data={})
    assert resp.status_code == 200

    cloned_study_data = resp.json()
    cloned_study_id = cloned_study_data["id"]

    # Count conditions after cloning
    conditions_after = Condition.query.count()

    # Get the cloned study from database
    cloned_study = Study.query.filter_by(id=cloned_study_id).first()
    assert cloned_study is not None

    # Get conditions from cloned study
    cloned_conditions = []
    for analysis in cloned_study.analyses:
        for ac in analysis.analysis_conditions:
            cloned_conditions.append(ac.condition)

    # The key test: condition should have the same ID (not cloned)
    assert len(cloned_conditions) == 1, f"Expected 1 condition, got {len(cloned_conditions)}"

    cloned_condition = cloned_conditions[0]

    # THIS IS THE MAIN TEST: Condition ID should be preserved
    assert cloned_condition.id == test_condition.id, (
        f"Condition was cloned! Original ID: {test_condition.id}, "
        f"Cloned ID: {cloned_condition.id}"
    )

    # Total condition count should not increase
    assert conditions_after == conditions_before, (
        f"Condition count increased from {conditions_before} to {conditions_after}. "
        "Conditions should not be cloned!"
    )


def test_study_cloning_creates_new_study_id(auth_client, ingest_neurosynth):
    """
    Test that studies get new IDs when cloned (normal cloning behavior).
    This confirms that the preserve_on_clone flag only affects conditions, not studies.
    """
    # Get a study to clone
    original_study = Study.query.first()
    if not original_study:
        pytest.skip("No study found")

    # Clone the study
    resp = auth_client.post(f"/api/studies/?source_id={original_study.id}", data={})
    assert resp.status_code == 200

    cloned_study_data = resp.json()
    cloned_study_id = cloned_study_data["id"]

    # Study should have a new ID
    assert cloned_study_id != original_study.id, "Study should be cloned with new ID"

    # Verify cloned study exists in database
    cloned_study = Study.query.filter_by(id=cloned_study_id).first()
    assert cloned_study is not None
    assert cloned_study.name == original_study.name  # Same content
    assert cloned_study.id != original_study.id  # Different ID

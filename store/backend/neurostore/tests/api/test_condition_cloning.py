from ...models import Study, Analysis, Condition, AnalysisConditions
from neurostore.models import User


def test_condition_cloning_neurovault(auth_client, ingest_neurovault, session):
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

    # Count total conditions before cloning
    total_conditions_before = Condition.query.count()

    # Clone the study via API
    resp = auth_client.post(
        f"/api/studies/?source_id={study_with_conditions.id}", data={}
    )
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
        assert (
            matching_cloned_cond is not None
        ), f"No matching condition found for {orig_cond.name}"

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


def test_condition_cloning_cross_user_permissions(auth_client, session):
    """
    Test that users can clone studies referencing conditions owned by other users.
    The conditions should be read-only references, not attempts to modify the originals.
    """
    # Get the authenticated user from auth_client
    user_id = auth_client.username

    # Create another user who will own the conditions
    condition_owner_data = {"external_id": "condition_owner", "name": "Condition Owner"}
    condition_owner = User(**condition_owner_data)
    session.add(condition_owner)
    session.commit()  # Commit the user first

    # Create a test condition owned by the condition owner
    test_condition = Condition(
        name="Cross User Test Condition",
        description="A test condition for cross-user cloning",
        user_id=condition_owner.external_id,
    )
    session.add(test_condition)
    session.flush()

    # Create a test study owned by the condition owner
    test_study = Study(
        name="Cross User Test Study",
        description="A test study for cross-user cloning",
        user_id=condition_owner.external_id,
    )
    session.add(test_study)
    session.flush()

    # Create a test analysis
    test_analysis = Analysis(
        name="Cross User Test Analysis",
        study_id=test_study.id,
        user_id=condition_owner.external_id,
    )
    session.add(test_analysis)
    session.flush()

    # Link analysis to condition
    analysis_condition = AnalysisConditions(
        analysis_id=test_analysis.id, condition_id=test_condition.id, weight=1.0
    )
    session.add(analysis_condition)
    session.commit()

    # Count conditions before cloning
    conditions_before = Condition.query.count()

    # Clone the study using the API (auth_client is a different user)
    resp = auth_client.post(f"/api/studies/?source_id={test_study.id}", data={})

    # This should now work with our fix
    assert (
        resp.status_code == 200
    ), f"Expected 200, got {resp.status_code}. Response: {resp.json()}"

    cloned_study_data = resp.json()
    cloned_study_id = cloned_study_data["id"]

    # Count conditions after cloning
    conditions_after = Condition.query.count()

    # Get the cloned study from database
    cloned_study = Study.query.filter_by(id=cloned_study_id).first()
    assert cloned_study is not None
    assert (
        cloned_study.user_id == user_id
    )  # Cloned study should be owned by auth_client user

    # Get conditions from cloned study
    cloned_conditions = []
    for analysis in cloned_study.analyses:
        for ac in analysis.analysis_conditions:
            cloned_conditions.append(ac.condition)

    # The key test: condition should have the same ID (not cloned)
    # but still be owned by original user
    assert (
        len(cloned_conditions) == 1
    ), f"Expected 1 condition, got {len(cloned_conditions)}"

    cloned_condition = cloned_conditions[0]

    # THIS IS THE MAIN TEST: Condition ID should be preserved
    assert cloned_condition.id == test_condition.id, (
        f"Condition was cloned! Original ID: {test_condition.id}, "
        f"Cloned ID: {cloned_condition.id}"
    )

    # Condition should still be owned by original user (read-only reference)
    assert cloned_condition.user_id == condition_owner.external_id, (
        f"Condition ownership changed! Expected {condition_owner.external_id}, "
        f"got {cloned_condition.user_id}"
    )

    # Total condition count should not increase
    assert conditions_after == conditions_before, (
        f"Condition count increased from {conditions_before} to {conditions_after}. "
        "Conditions should not be cloned!"
    )


def test_condition_cloning_new_data(auth_client, session):
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
    test_analysis = Analysis(
        name="Test Analysis", study_id=test_study.id, user_id=user_id
    )
    session.add(test_analysis)
    session.flush()  # Get the ID

    # Link analysis to condition
    analysis_condition = AnalysisConditions(
        analysis_id=test_analysis.id, condition_id=test_condition.id, weight=1.0
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
    assert (
        len(cloned_conditions) == 1
    ), f"Expected 1 condition, got {len(cloned_conditions)}"

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


def test_debug_condition_serialization_cloning(session):
    """Debug how conditions are serialized during cloning"""
    from neurostore.schemas.data import ConditionSchema

    # Create a test user
    test_user = User(name="testuser", external_id="test123")
    session.add(test_user)
    session.commit()

    # Create a test condition
    condition = Condition(
        name="Debug Condition",
        description="For debugging",
        user_id=test_user.external_id,
    )
    session.add(condition)
    session.commit()

    # Test normal serialization (no clone context)
    normal_schema = ConditionSchema()
    normal_data = normal_schema.dump(condition)
    print(f"Normal serialization: {normal_data}")

    # Test cloning serialization
    clone_schema = ConditionSchema(context={"clone": True})
    clone_data = clone_schema.dump(condition)
    print(f"Clone serialization: {clone_data}")

    # Check what gets deserialized back
    loaded_data = clone_schema.load(clone_data)
    print(f"Clone loaded: {loaded_data}")

    # Check if only_ids would be True
    only_ids = set(clone_data.keys()) - set(["id"]) == set()
    print(f"only_ids check: {only_ids}")

    # This should be True with our fix (only ID field included)
    assert only_ids, f"Expected only ID field, got fields: {list(clone_data.keys())}"
    assert clone_data["id"] == condition.id, "ID should be preserved"
    assert (
        len(clone_data) == 1
    ), f"Should only have ID field, got {len(clone_data)} fields"

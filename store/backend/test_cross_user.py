from ...models import Study, Analysis, Condition, AnalysisConditions
from neurostore.models import User


def test_condition_cloning_cross_user_permissions(auth_client, session):
    """
    Test that users can clone studies referencing conditions owned by other users.
    The conditions should be read-only references, not attempts to modify the originals.
    """
    # Get the authenticated user from auth_client
    user_id = auth_client.username
    
    # Create another user who will own the conditions
    condition_owner_data = {
        'external_id': 'condition_owner',
        'name': 'Condition Owner'
    }
    condition_owner = User(**condition_owner_data)
    session.add(condition_owner)
    session.flush()
    
    # Create a test condition owned by the condition owner
    test_condition = Condition(
        name="Cross User Test Condition",
        description="A test condition for cross-user cloning",
        user_id=condition_owner.id
    )
    session.add(test_condition)
    session.flush()
    
    # Create a test study owned by the condition owner
    test_study = Study(
        name="Cross User Test Study",
        description="A test study for cross-user cloning",
        user_id=condition_owner.id
    )
    session.add(test_study)
    session.flush()
    
    # Create a test analysis
    test_analysis = Analysis(
        name="Cross User Test Analysis",
        study_id=test_study.id,
        user_id=condition_owner.id
    )
    session.add(test_analysis)
    session.flush()
    
    # Link analysis to condition
    analysis_condition = AnalysisConditions(
        analysis_id=test_analysis.id,
        condition_id=test_condition.id,
        weight=1.0
    )
    session.add(analysis_condition)
    session.commit()
    
    print(f"Created study {test_study.id} owned by {condition_owner.id}")
    print(f"Created condition {test_condition.id} owned by {condition_owner.id}")
    print(f"Auth client user: {user_id}")
    
    # Count conditions before cloning
    conditions_before = Condition.query.count()
    
    # Clone the study using the API (auth_client is a different user)
    resp = auth_client.post(f"/api/studies/?source_id={test_study.id}", data={})
    print(f"Response status: {resp.status_code}")
    print(f"Response data: {resp.json() if resp.status_code != 403 else 'Access denied'}")
    
    # This should now work with our fix
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}. Response: {resp.json() if hasattr(resp, 'json') else resp.text}"
    
    cloned_study_data = resp.json()
    cloned_study_id = cloned_study_data["id"]
    
    # Count conditions after cloning
    conditions_after = Condition.query.count()
    
    # Get the cloned study from database
    cloned_study = Study.query.filter_by(id=cloned_study_id).first()
    assert cloned_study is not None
    assert cloned_study.user_id == user_id  # Cloned study should be owned by auth_client user
    
    # Get conditions from cloned study
    cloned_conditions = []
    for analysis in cloned_study.analyses:
        for ac in analysis.analysis_conditions:
            cloned_conditions.append(ac.condition)
    
    # The key test: condition should have the same ID (not cloned) but still be owned by original user
    assert len(cloned_conditions) == 1, f"Expected 1 condition, got {len(cloned_conditions)}"
    
    cloned_condition = cloned_conditions[0]
    
    # THIS IS THE MAIN TEST: Condition ID should be preserved
    assert cloned_condition.id == test_condition.id, (
        f"Condition was cloned! Original ID: {test_condition.id}, "
        f"Cloned ID: {cloned_condition.id}"
    )
    
    # Condition should still be owned by original user (read-only reference)
    assert cloned_condition.user_id == condition_owner.id, (
        f"Condition ownership changed! Expected {condition_owner.id}, got {cloned_condition.user_id}"
    )
    
    # Total condition count should not increase
    assert conditions_after == conditions_before, (
        f"Condition count increased from {conditions_before} to {conditions_after}. "
        "Conditions should not be cloned!"
    )
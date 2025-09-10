"""
Test to debug condition serialization during cloning
"""
from neurostore.schemas.data import ConditionSchema
from neurostore.models import Condition, User


def test_debug_condition_serialization_cloning(session):
    """Debug how conditions are serialized during cloning"""
    
    # Create a test user
    test_user = User(name="testuser", external_id="test123")
    session.add(test_user)
    session.commit()
    
    # Create a test condition
    condition = Condition(
        name="Debug Condition",
        description="For debugging",
        user_id=test_user.id
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
    assert clone_data["id"] == condition.id, f"ID should be preserved"
    assert len(clone_data) == 1, f"Should only have ID field, got {len(clone_data)} fields"
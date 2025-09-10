"""
Debug script to understand condition cloning data flow
"""

from neurostore.models import Study, Analysis, Condition, AnalysisConditions, User
from neurostore.resources.data import StudiesView
from neurostore.schemas.data import StudySchema, AnalysisSchema
from neurostore.core import db
from neurostore.tests.request_utils import Client

def test_debug_condition_data():
    """Debug what data is passed for conditions during cloning"""
    
    # Create a test user
    test_user = User(name="testuser", external_id="test123")
    db.session.add(test_user)
    db.session.flush()
    
    # Create another user who owns conditions
    condition_owner = User(name="condowner", external_id="cond456") 
    db.session.add(condition_owner)
    db.session.flush()
    
    # Create a test condition owned by condition_owner
    test_condition = Condition(
        name="Test Condition",
        description="A test condition",
        user_id=condition_owner.id
    )
    db.session.add(test_condition)
    db.session.flush()
    
    # Create a test study owned by test_user
    test_study = Study(
        name="Test Study",
        description="A test study",
        user_id=test_user.id
    )
    db.session.add(test_study)
    db.session.flush()
    
    # Create a test analysis
    test_analysis = Analysis(
        name="Test Analysis",
        study_id=test_study.id,
        user_id=test_user.id
    )
    db.session.add(test_analysis)
    db.session.flush()
    
    # Link analysis to condition
    analysis_condition = AnalysisConditions(
        analysis_id=test_analysis.id,
        condition_id=test_condition.id,
        weight=1.0
    )
    db.session.add(analysis_condition)
    db.session.commit()
    
    print(f"Created study {test_study.id} owned by {test_user.id}")
    print(f"Created condition {test_condition.id} owned by {condition_owner.id}")
    
    # Now test how the study gets serialized for cloning
    study_schema = StudySchema(context={"clone": True, "nested": True})
    serialized_study = study_schema.dump(test_study)
    
    print("=== SERIALIZED STUDY ===")
    import json
    print(json.dumps(serialized_study, indent=2))
    
    # Check specifically what data is in the conditions
    analyses = serialized_study.get("analyses", [])
    if analyses:
        analysis = analyses[0]
        analysis_conditions = analysis.get("analysis_conditions", [])
        if analysis_conditions:
            ac = analysis_conditions[0]
            condition_data = ac.get("condition", {})
            print(f"=== CONDITION DATA ===")
            print(f"Condition keys: {list(condition_data.keys())}")
            print(f"Condition data: {condition_data}")
            
            # Check if this would pass the only_ids test
            only_ids = set(condition_data.keys()) - set(["id"]) == set()
            print(f"only_ids check: {only_ids}")
    
    db.session.rollback()  # Clean up

if __name__ == "__main__":
    test_debug_condition_data()
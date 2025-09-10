#!/usr/bin/env python
"""Test script to understand the current condition cloning behavior."""

import pytest
import sys
import os

from neurostore.models import Study, Analysis, Condition, AnalysisConditions

def test_condition_cloning_behavior(auth_client, ingest_neurovault, session):
    """
    Test to see if conditions are being cloned when a study is cloned.
    This test should fail initially because conditions are being cloned.
    After the fix, conditions should NOT be cloned (keep original references).
    """
    # Get the first study that has conditions
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
    
    print(f"\nOriginal study ID: {study_with_conditions.id}")
    print(f"Original conditions: {[(c.id, c.name) for c in original_conditions]}")
    
    # Clone the study
    resp = auth_client.post(f"/api/studies/?source_id={study_with_conditions.id}", data={})
    assert resp.status_code == 200
    
    cloned_study_data = resp.json()
    cloned_study_id = cloned_study_data["id"]
    
    print(f"Cloned study ID: {cloned_study_id}")
    
    # Get the cloned study from database
    cloned_study = Study.query.filter_by(id=cloned_study_id).first()
    assert cloned_study is not None
    
    # Check conditions in the cloned study
    cloned_conditions = []
    for analysis in cloned_study.analyses:
        for ac in analysis.analysis_conditions:
            cloned_conditions.append(ac.condition)
    
    print(f"Cloned conditions: {[(c.id, c.name) for c in cloned_conditions]}")
    
    # The requirement: conditions should NOT be cloned, they should reference originals
    for orig_cond in original_conditions:
        # Find corresponding condition in cloned study by name
        matching_cloned_cond = next(
            (c for c in cloned_conditions if c.name == orig_cond.name), None
        )
        assert matching_cloned_cond is not None, f"No matching condition found for {orig_cond.name}"
        
        # THIS IS THE KEY TEST: The condition IDs should be the same (not cloned)
        assert matching_cloned_cond.id == orig_cond.id, (
            f"Condition was cloned! Original ID: {orig_cond.id}, "
            f"Cloned ID: {matching_cloned_cond.id}, Name: {orig_cond.name}"
        )
    
    print("SUCCESS: Conditions were not cloned, original references preserved!")
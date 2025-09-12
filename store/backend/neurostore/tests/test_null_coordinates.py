#!/usr/bin/env python3

import pytest
from marshmallow import ValidationError
from neurostore.tests.api.test_studies import test_clone_studies as original_clone_test

def test_point_schema_null_coordinates_validation():
    """Test that PointSchema rejects null coordinates for new points"""
    from neurostore.schemas.data import PointSchema
    
    point_data = {
        "analysis": "test_analysis_id", 
        "coordinates": [None, None, None],
        "space": "MNI",
        "order": 0
    }
    
    schema = PointSchema()
    
    with pytest.raises(ValidationError) as exc_info:
        schema.load(point_data)
    
    assert "Points cannot have all null coordinates" in str(exc_info.value)


def test_point_schema_null_coordinates_cloning():
    """Test that PointSchema raises special error for filtering during cloning"""
    from neurostore.schemas.data import PointSchema
    
    point_data = {
        "analysis": "test_analysis_id",
        "coordinates": [None, None, None], 
        "space": "MNI",
        "order": 0
    }
    
    schema = PointSchema(context={"clone": True})
    
    with pytest.raises(ValidationError) as exc_info:
        schema.load(point_data)
    
    assert "SKIP_NULL_COORDINATES_POINT" in str(exc_info.value)


def test_point_schema_valid_coordinates():
    """Test that valid coordinates work normally"""  
    from neurostore.schemas.data import PointSchema
    
    point_data = {
        "analysis": "test_analysis_id",
        "coordinates": [1.0, 2.0, 3.0],
        "space": "MNI", 
        "order": 0
    }
    
    schema = PointSchema()
    result = schema.load(point_data)
    
    assert result["x"] == 1.0
    assert result["y"] == 2.0 
    assert result["z"] == 3.0


def test_analysis_schema_filters_null_coordinates():
    """Test that StringOrNested filters points with null coordinates during cloning"""
    from neurostore.schemas.data import AnalysisSchema
    
    analysis_data = {
        "study": "test_study_id",
        "name": "test_analysis",
        "points": [
            {
                "analysis": "test_analysis_id",
                "coordinates": [1.0, 2.0, 3.0],
                "space": "MNI",
                "order": 0
            },
            {
                "analysis": "test_analysis_id", 
                "coordinates": [None, None, None],
                "space": "MNI",
                "order": 1
            }
        ]
    }
    
    schema = AnalysisSchema(context={"clone": True, "nested": True})
    result = schema.load(analysis_data)
    
    # Should have filtered out the null coordinate point
    points = result.get("points", [])
    assert len(points) == 1  # Only the valid point should remain
    
    # Verify the remaining point has valid coordinates
    assert points[0]["x"] == 1.0
    assert points[0]["y"] == 2.0
    assert points[0]["z"] == 3.0
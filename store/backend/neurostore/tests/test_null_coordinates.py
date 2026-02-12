#!/usr/bin/env python3

import pytest


def test_point_schema_null_coordinates_allowed():
    """Test that PointSchema allows null coordinates for incremental saves"""
    from neurostore.schemas.data import PointSchema

    point_data = {
        "analysis": "test_analysis_id",
        "coordinates": [None, None, None],
        "space": "MNI",
        "order": 0,
    }

    schema = PointSchema()
    result = schema.load(point_data)
    assert result["x"] is None
    assert result["y"] is None
    assert result["z"] is None


def test_point_schema_null_coordinates_cloning():
    """Test that PointSchema handles null coordinates during cloning"""
    from neurostore.schemas.data import PointSchema

    point_data = {
        "analysis": "test_analysis_id",
        "coordinates": [None, None, None],
        "space": "MNI",
        "order": 0,
    }

    schema = PointSchema(context={"clone": True})

    # During cloning, null coordinates should be allowed and stored as None
    result = schema.load(point_data)

    assert result["x"] is None
    assert result["y"] is None
    assert result["z"] is None


def test_point_schema_valid_coordinates():
    """Test that valid coordinates work normally"""
    from neurostore.schemas.data import PointSchema

    point_data = {
        "analysis": "test_analysis_id",
        "coordinates": [1.0, 2.0, 3.0],
        "space": "MNI",
        "order": 0,
    }

    schema = PointSchema()
    result = schema.load(point_data)

    assert result["x"] == 1.0
    assert result["y"] == 2.0
    assert result["z"] == 3.0


def test_analysis_schema_allows_null_coordinates_during_cloning():
    """Test that AnalysisSchema allows null coordinate points during cloning"""
    from neurostore.schemas.data import AnalysisSchema

    analysis_data = {
        "study": "test_study_id",
        "name": "test_analysis",
        "points": [
            {
                "analysis": "test_analysis_id",
                "coordinates": [1.0, 2.0, 3.0],
                "space": "MNI",
                "order": 0,
            },
            {
                "analysis": "test_analysis_id",
                "coordinates": [None, None, None],
                "space": "MNI",
                "order": 1,
            },
        ],
    }

    schema = AnalysisSchema(context={"clone": True, "nested": True})
    result = schema.load(analysis_data)

    # Should have both points, including the null coordinate one
    points = result.get("points", [])
    assert len(points) == 2  # Both points should be present

    # Verify the valid point has valid coordinates
    valid_point = next(p for p in points if p["x"] == 1.0)
    assert valid_point["x"] == 1.0
    assert valid_point["y"] == 2.0
    assert valid_point["z"] == 3.0

    # Verify the null coordinate point has null coordinates
    null_point = next(p for p in points if p["x"] is None)
    assert null_point["x"] is None
    assert null_point["y"] is None
    assert null_point["z"] is None

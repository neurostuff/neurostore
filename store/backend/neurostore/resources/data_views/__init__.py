from importlib import import_module

DATA_VIEW_MODULES = {
    "AnalysesView": "neurostore.resources.data_views.analyses_view",
    "AnalysisConditionsResource": (
        "neurostore.resources.data_views.analysis_conditions_resource"
    ),
    "AnnotationAnalysesView": (
        "neurostore.resources.data_views.annotation_analyses_view"
    ),
    "AnnotationsView": "neurostore.resources.data_views.annotations_view",
    "BaseStudiesView": "neurostore.resources.data_views.base_studies_view",
    "ConditionsView": "neurostore.resources.data_views.conditions_view",
    "EntitiesResource": "neurostore.resources.data_views.entities_resource",
    "ImagesView": "neurostore.resources.data_views.images_view",
    "PointsView": "neurostore.resources.data_views.points_view",
    "PointValuesView": "neurostore.resources.data_views.point_values_view",
    "StudiesView": "neurostore.resources.data_views.studies_view",
    "StudysetStudiesResource": (
        "neurostore.resources.data_views.studyset_studies_resource"
    ),
    "StudysetsView": "neurostore.resources.data_views.studysets_view",
    "TablesView": "neurostore.resources.data_views.tables_view",
}

DATA_VIEW_EXPORTS = tuple(DATA_VIEW_MODULES)
__all__ = list(DATA_VIEW_EXPORTS)


def __getattr__(name):
    module_path = DATA_VIEW_MODULES.get(name)
    if module_path is None:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

    module = import_module(module_path)
    value = getattr(module, name)
    globals()[name] = value
    return value

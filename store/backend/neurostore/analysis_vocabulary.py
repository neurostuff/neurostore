"""What an analysis links to beyond its conditions, tasks and contrast, declared once.

Each `Feature` is a criterion of `POST /analysis-queries/` and the same key in a result's
`features`, named by the study_schema path it reads (`inference_settings.alpha_level`
reads `Analysis.inference_settings` -> `InferenceSettings.alpha_level`). From it come the
`analysis_features` column and its index (`neurostore.models.data`), the criterion
(`neurostore.analysis_query.FIELDS`), the ingester's mapping of values to columns and
wording (`neurostore.ingest.analysis_features.RecordDetails`), and the term listing of
value criteria. `slots` names the study_schema slots a feature reads, which a test checks
against the pinned schema.

Kinds: `text` (a lower-cased search column; the result shows the record's wording),
`value` (one lower-cased value), `array_value` (lower-cased values), `range` (a number),
`number_array` (a number per group or acquisition; a range matches when any is in range),
`boolean`.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Feature:
    path: str
    kind: str
    column: str
    slots: tuple = ()
    #: A range's numbers: "int" or "float".
    number: str = "float"
    #: The values a value criterion may take, when the records keep to them.
    values: tuple = ()

    @property
    def group(self):
        return self.path.rsplit(".", 1)[0]


def _f(path, kind, column, *slots, **options):
    return Feature(path, kind, column, slots, **options)


#: study_schema `SpatialScope`, which `InferenceSettings.correction_scope` takes.
SPATIAL_SCOPES = ("whole_brain", "roi", "searchlight")

FEATURES = (
    # Group: the analysis's groups; an item of each group (an age) matches when any group's
    # does. Ages in years; counts summed over the groups.
    _f("groups.age_mean", "number_array", "age_means", "Group.age_mean", "Group.age_unit"),
    _f("groups.age_standard_deviation", "number_array", "age_sds", "Group.age_standard_deviation"),
    _f("groups.age_minimum", "number_array", "age_minimums", "Group.age_minimum"),
    _f("groups.age_maximum", "number_array", "age_maximums", "Group.age_maximum"),
    _f("groups.age_median", "number_array", "age_medians", "Group.age_median"),
    _f(
        "groups.female_count",
        "range",
        "female_count",
        "Group.sex_distribution",
        "Group.gender_distribution",
        "CategoryDistribution.count",
        "CategoryDistribution.percentage",
        "CategoryDistribution.denominator",
        number="int",
    ),
    _f("groups.male_count", "range", "male_count", "Group.sex_distribution", number="int"),
    _f("groups.female_percent", "range", "female_percent", "Group.sex_distribution"),
    _f("groups.handedness", "array_value", "handedness", "Group.handedness_distribution"),
    _f("groups.enrolled_count", "range", "enrolled_count", "Group.enrolled_count", number="int"),
    _f("groups.acquired_count", "range", "acquired_count", "Group.acquired_count", number="int"),
    _f("groups.excluded_count", "range", "excluded_count", "Group.excluded_count", number="int"),
    _f(
        "groups.diagnostic_instrument",
        "text",
        "diagnostic_instrument_text",
        "Group.diagnostic_instrument",
        "Assessment.name",
    ),
    _f("groups.diagnostic_system", "text", "diagnostic_system_text", "Group.diagnostic_system"),
    _f(
        "groups.clinical_characteristics",
        "text",
        "clinical_text",
        "Group.clinical_characteristics",
    ),
    _f("groups.education_summary", "text", "education_text", "Group.education_summary"),
    # Analysis.inference_settings.
    _f(
        "inference_settings.inference_level",
        "text",
        "inference_level_text",
        "InferenceSettings.inference_level",
    ),
    _f(
        "inference_settings.height_threshold_value",
        "range",
        "height_threshold",
        "InferenceSettings.height_threshold_value",
    ),
    _f(
        "inference_settings.height_threshold_type",
        "text",
        "height_threshold_type_text",
        "InferenceSettings.height_threshold_type",
    ),
    _f(
        "inference_settings.cluster_extent_threshold",
        "range",
        "cluster_extent",
        "InferenceSettings.cluster_extent_threshold",
        number="int",
    ),
    _f(
        "inference_settings.clusterwise_threshold_value",
        "range",
        "cluster_threshold",
        "InferenceSettings.clusterwise_threshold_value",
    ),
    _f(
        "inference_settings.multiple_comparison_method",
        "text",
        "correction_text",
        "InferenceSettings.multiple_comparison_method",
    ),
    _f(
        "inference_settings.correction_scope",
        "value",
        "correction_scope",
        "InferenceSettings.correction_scope",
        values=SPATIAL_SCOPES,
    ),
    _f("inference_settings.alpha_level", "range", "alpha", "InferenceSettings.alpha_level"),
    _f("inference_settings.tfce_used", "boolean", "tfce", "InferenceSettings.tfce_used"),
    _f(
        "inference_settings.permutation_count",
        "range",
        "permutations",
        "InferenceSettings.permutation_count",
        number="int",
    ),
    # Analysis.acquisitions: one item each. The voxel size is its largest dimension.
    _f("acquisitions.modality", "array_value", "modalities", "Acquisition.modality"),
    _f(
        "acquisitions.magnetic_field_strength_tesla",
        "number_array",
        "field_strengths",
        "MRI.magnetic_field_strength_tesla",
    ),
    _f(
        "acquisitions.repetition_time_seconds",
        "number_array",
        "repetition_times",
        "MRI.repetition_time_seconds",
    ),
    _f(
        "acquisitions.echo_time_seconds",
        "number_array",
        "echo_times",
        "MRI.echo_time_seconds",
    ),
    _f(
        "acquisitions.acquisition_voxel_size_mm",
        "number_array",
        "voxel_sizes",
        "MRI.acquisition_voxel_size_mm",
    ),
    # Manufacturer and model.
    _f(
        "acquisitions.device",
        "text",
        "scanner_text",
        "Acquisition.device",
        "Device.manufacturer",
        "Device.model",
    ),
    # Analysis.model_estimation, the models it takes inputs from, and their preprocessing.
    _f(
        "preprocessing.smoothing_fwhm_mm",
        "number_array",
        "smoothing_fwhms",
        "ModelEstimation.preprocessing",
        "Preprocessing.smoothing_fwhm_mm",
    ),
    _f("preprocessing.software", "text", "preprocessing_software_text", "Preprocessing.software"),
    _f("preprocessing.steps", "text", "preprocessing_steps_text", "Preprocessing.steps"),
    _f(
        "model_estimation.model_family",
        "text",
        "model_family_text",
        "ModelEstimation.model_family",
        "ModelEstimation.inputs_from",
    ),
    _f("model_estimation.model_type", "text", "model_type_text", "ModelEstimation.model_type"),
    _f("model_estimation.software", "text", "model_software_text", "ModelEstimation.software"),
    _f("model_estimation.hrf_model", "text", "hrf_model_text", "ModelEstimation.hrf_model"),
    _f("model_estimation.estimator", "text", "estimator_text", "ModelEstimation.estimator"),
    _f(
        "model_estimation.terms.name",
        "text",
        "model_term_text",
        "ModelEstimation.terms",
        "ModelTerm.name",
    ),
    _f("model_estimation.terms.type", "array_value", "model_term_types", "ModelTerm.type"),
    # Analysis.effect.statistic.
    _f(
        "effect.statistic.family",
        "value",
        "statistic_family",
        "Effect.statistic",
        "Statistic.family",
    ),
    _f(
        "effect.statistic.degrees_of_freedom_numerator",
        "range",
        "df_numerator",
        "Statistic.degrees_of_freedom_numerator",
    ),
    _f(
        "effect.statistic.degrees_of_freedom_denominator",
        "range",
        "df_denominator",
        "Statistic.degrees_of_freedom_denominator",
    ),
    # Analysis.details of a connectivity analysis; regions by their names.
    _f(
        "details.connectivity_method",
        "value",
        "connectivity_method",
        "ConnectivityDetails.connectivity_method",
    ),
    _f(
        "details.inference_target",
        "value",
        "connectivity_inference_target",
        "ConnectivityDetails.inference_target",
    ),
    _f(
        "details.seed_regions",
        "text",
        "seed_region_text",
        "ConnectivityDetails.seed_regions",
        "Region.name",
    ),
    _f(
        "details.target_regions",
        "text",
        "target_region_text",
        "ConnectivityDetails.target_regions",
        "Region.name",
    ),
    # The regions the analysis names, its seeds and targets, and its coordinate sets'.
    _f("regions.name", "text", "region_text", "Analysis.regions", "Region.name"),
    _f("regions.atlas", "text", "region_atlas_text", "Region.atlas"),
    _f("regions.region_type", "array_value", "region_types", "Region.region_type"),
    _f(
        "regions.definition_method",
        "array_value",
        "region_definitions",
        "Region.definition_method",
    ),
    # The coordinate sets that name the analysis.
    _f(
        "coordinate_sets.role",
        "array_value",
        "coordinate_roles",
        "CoordinateSet.analysis",
        "CoordinateSet.role",
    ),
    _f(
        "coordinate_sets.result_kind",
        "array_value",
        "result_kinds",
        "CoordinateSet.result_kind",
    ),
    _f(
        "coordinate_sets.anchor_kind",
        "array_value",
        "anchor_kinds",
        "CoordinateSet.anchor_kind",
    ),
    # Analysis.tasks beyond their paradigm; stimuli include their stimulus content.
    _f("tasks.stimuli", "text", "stimulus_text", "Task.stimuli", "Task.stimulus_content"),
    _f(
        "tasks.stimulus_modality",
        "array_value",
        "stimulus_modalities",
        "Task.stimulus_modality",
    ),
    _f(
        "tasks.response_modality",
        "array_value",
        "response_modalities",
        "Task.response_modality",
    ),
    _f("tasks.design_type", "array_value", "design_types", "Task.design_type"),
    _f("tasks.instructions", "text", "instructions_text", "Task.instructions"),
    _f(
        "tasks.performance_measures",
        "text",
        "performance_text",
        "Task.performance_measures",
    ),
)
BY_PATH = {feature.path: feature for feature in FEATURES}
#: The groups the features nest in, outermost first (`model_estimation` before
#: `model_estimation.terms`).
GROUPS = tuple(
    sorted(
        {
            ".".join(f.path.split(".")[:i])
            for f in FEATURES
            for i in range(1, f.path.count(".") + 1)
        },
        key=lambda group: (group.count("."), group),
    )
)

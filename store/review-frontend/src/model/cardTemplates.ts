/** A slot's value in a sentence, by its path (`$path` for short), its list values joined by `join`. */
export interface SlotPhrase {
    slot: string;
    join?: string;
}

/** Clauses said one after another, `join` between the ones kept. */
export interface Joined {
    join: string;
    parts: Phrase[];
}

/**
 * A range of two slots, its unit after the numbers: "a–b unit", "a unit or older" with only its start, "up to b unit"
 * with only its end; where its `centre` shows, the centre and the unit, then the range in brackets.
 */
export interface Range {
    range: [from: string, to: string];
    unit?: string;
    centre?: Phrase;
}

/**
 * A part of a card's sentence: words; `$path`, a slot's value; a clause (an array), left out with its words while it
 * shows no slot; clauses joined; or a range.
 */
export type Phrase = string | SlotPhrase | Joined | Range | Phrase[];

export interface RowSpec {
    slot: string;
    label: string;
}

export interface LinkSpec {
    label: string;
    slot: string;
    /** What the linker does to what the slot links, where the label reads as a verb: `mirrors` for `mirror of`. */
    verb?: string;
}

/** The child entities of a class a card lists among its links, as chips that open them. */
export interface ChildSpec {
    label: string;
    entityClass: string;
    /** The slot the schema holds the children's list in, where the record index takes it for a reference. */
    slot?: string;
}

/**
 * How a class's card is laid out, its name slot being its title: its sentences of short fields, then short fields said as "label value", one-line
 * rows of long ones, and its links. A list (a slot path its items sit under) is said on one line wherever it is put.
 */
export interface CardTemplate {
    about: Phrase[][];
    pairs?: string[];
    rows?: (string | RowSpec)[];
    links?: LinkSpec[];
    children?: ChildSpec[];
}

/** Words for values in a sentence, by `<attribute>:<value>`, else by the value. */
export const VALUE_WORDS: Record<string, string> = {
    'spatial_scope:whole_brain': 'the whole brain',
    'spatial_scope:roi': 'regions of interest',
    'spatial_scope:searchlight': 'a searchlight',
    'correction_scope:whole_brain': 'the whole brain',
    'correction_scope:roi': 'regions of interest',
    'brain_coverage:whole_brain': 'whole-brain',
    'brain_coverage:partial': 'partial',
    'family:f': 'F',
    'family:chi_square': 'χ²',
    'family:beta': 'β',
    'family:likelihood_ratio': 'a likelihood ratio',
    'family:correlation': 'a correlation',
    significant_effect: 'a significant effect',
    no_significant_effect: 'no significant effect',
    simple_effect: 'simple-effect',
    parametric_modulation: 'parametric-modulation',
    cross_subject_regression: 'cross-subject regression',
    'design_type:block': 'a block',
    'design_type:event_related': 'an event-related',
    'design_type:mixed': 'a mixed',
    'design_type:continuous': 'a continuous',
    pre_intervention: 'pre-intervention',
    post_intervention: 'post-intervention',
    during_intervention: 'during the intervention',
    analyses_reported: 'reported here',
    no_analyses_reported: 'none reported',
    analyses_reported_elsewhere: 'reported elsewhere',
    double_blind: 'double-blind',
    open_label: 'open-label',
    glm: 'GLM',
    anova: 'ANOVA',
    ancova: 'ANCOVA',
    mixed_effects: 'mixed-effects',
    public_dataset: 'from a public dataset',
    previously_reported: 'previously reported',
    within_subject: 'within subjects',
    between_subject: 'between subjects',
    bold_response: 'BOLD response',
    bold_derived_metric: 'BOLD-derived metric',
    functional_bold: 'functional BOLD',
    ica: 'ICA',
    pca: 'PCA',
    pls: 'PLS',
    cca: 'CCA',
    nmf: 'NMF',
    ppi: 'PPI',
    gppi: 'gPPI',
    dcm: 'DCM',
};

const ACQUISITION_TAIL: Phrase[] = [
    [', ', '$acquisition_duration_seconds', ' s long'],
    [', ', '$brain_coverage', ' coverage'],
];
const ACQUISITION_LINKS: LinkSpec[] = [{ label: 'device', slot: 'device' }];

/** The card layout of each class of the extraction schema, by its schema class. */
export const CARD_TEMPLATES: Record<string, CardTemplate> = {
    Study: {
        about: [
            [
                ['$design.allocation', ' '],
                ['$design.assignment_structure', ' '],
                'design',
                [', ', '$design.blinding'],
                ['; analyses: ', '$result_reporting'],
                '.',
            ],
        ],
        rows: ['description', 'hypothesis', { slot: 'design.description', label: 'Design' }, 'external_datasets'],
        children: [
            { label: 'arms', entityClass: 'Arm', slot: 'design.arms' },
            { label: 'timepoints', entityClass: 'Timepoint', slot: 'design.timepoints' },
        ],
    },
    Arm: {
        about: [[['$arm_kind', ' '], 'arm', [' with ', '$agent'], '.']],
        rows: ['description'],
    },
    Timepoint: {
        about: [
            ['timepoint', [' ', '$order'], [', ', '$relation_to_intervention'], [', ', '$time_from_intervention'], '.'],
        ],
    },
    Group: {
        about: [
            [
                ['$acquired_count', ' '],
                ['$species', ' '],
                'participants',
                [
                    ' aged ',
                    {
                        range: ['age_minimum', 'age_maximum'],
                        unit: 'age_unit',
                        centre: ['$age_mean', [' ± ', '$age_standard_deviation']],
                    },
                ],
                [', median ', '$age_median'],
                [', ', '$sex_distribution'],
                ['; ', { join: ', ', parts: ['$medical_condition', ['diagnosed by ', '$diagnostic_system']] }],
                ['; healthy: ', '$is_healthy'],
                '.',
            ],
            [
                {
                    join: ', ',
                    parts: [
                        ['$approached_count', ' approached'],
                        ['$consented_count', ' consented'],
                        ['$enrolled_count', ' enrolled'],
                        ['$excluded_count', ' excluded'],
                    ],
                },
                ['; ', '$sample_source', [' (', '$sample_source_reference', ')']],
                ['; ', '$sample_overlap_count', ' overlapping with another sample'],
                '.',
            ],
        ],
        pairs: ['age_unit_normalized'],
        rows: [
            'description',
            'inclusion_criteria',
            'exclusion_criteria',
            'recruitment_method',
            'recruitment_dates',
            { slot: 'gender_distribution', label: 'Gender' },
            { slot: 'handedness_distribution', label: 'Handedness' },
            { slot: 'race_distribution', label: 'Race' },
            { slot: 'ethnicity_distribution', label: 'Ethnicity' },
            'population_characteristics',
            'clinical_characteristics',
            'medications',
            'medication_status',
            'education_summary',
            { slot: 'socioeconomic_status_summary', label: 'Socioeconomic status' },
            'other_characteristics',
        ],
        links: [
            { label: 'arm', slot: 'arm' },
            { label: 'diagnosed with', slot: 'diagnostic_instrument', verb: 'is diagnosed with' },
        ],
    },
    Task: {
        about: [
            [
                ['$paradigm', ' '],
                'task',
                [' in ', '$design_type', ' design'],
                [', ', '$stimulus_modality', ' stimuli'],
                [', ', '$response_modality', ' responses'],
                [', run in ', '$presentation_software'],
                '.',
            ],
        ],
        rows: [
            'description',
            { slot: 'variant_qualifiers', label: 'Variants' },
            'instructions',
            'stimuli',
            'stimulus_content',
            'performance_measures',
            'references',
        ],
        links: [{ label: 'acquisitions', slot: 'acquisitions' }],
        children: [{ label: 'conditions', entityClass: 'Condition' }],
    },
    Condition: {
        about: [[['$condition_kind', ' '], 'condition', [' showing ', '$stimulus_content'], '.']],
        rows: ['description'],
    },
    Assessment: {
        about: [[['$assessment_type', ' '], 'assessment', '.']],
        rows: ['description'],
    },
    Region: {
        about: [[['$region_type', ' '], 'region', [' defined by ', '$definition_method'], [', from ', '$atlas'], '.']],
        rows: ['description'],
    },
    Device: {
        about: [[['made by ', '$manufacturer'], [', model ', '$model'], '.']],
    },
    Acquisition: {
        about: [['$modality', ' acquisition', ...ACQUISITION_TAIL, '.']],
        links: ACQUISITION_LINKS,
    },
    MRI: {
        about: [
            [
                '$modality',
                [' at ', '$magnetic_field_strength_tesla', ' T'],
                [' with ', '$pulse_sequence_type', [' (', '$mr_acquisition_type', ')']],
                [', TR ', '$repetition_time_seconds', ' s'],
                [', TE ', { slot: 'echo_time_seconds', join: ', ' }, ' s'],
                [', voxels ', { slot: 'acquisition_voxel_size_mm', join: ' × ' }, ' mm'],
                [', ', '$number_of_volumes', ' volumes'],
                ...ACQUISITION_TAIL,
                '.',
            ],
        ],
        links: ACQUISITION_LINKS,
    },
    EEG: {
        about: [
            [
                '$modality',
                [' at ', '$sampling_frequency_hz', ' Hz'],
                [', ', '$eeg_channel_count', ' channels'],
                [', ', '$recording_type', ' recording'],
                ...ACQUISITION_TAIL,
                '.',
            ],
        ],
        rows: [
            { slot: 'eeg_placement_scheme', label: 'Placement' },
            { slot: 'eeg_reference', label: 'Reference' },
        ],
        links: ACQUISITION_LINKS,
    },
    FNIRS: {
        about: [
            [
                '$modality',
                [' (', '$nirs_system_type', ')'],
                [' at ', '$sampling_frequency_hz', ' Hz'],
                [', ', '$nirs_channel_count', ' channels'],
                [', ', '$short_channel_count', ' short channels'],
                [', wavelengths ', '$wavelengths_nm', ' nm'],
                [', source–detector distances ', '$source_detector_distances_mm', ' mm'],
                ...ACQUISITION_TAIL,
                '.',
            ],
        ],
        rows: [
            { slot: 'nirs_placement_scheme', label: 'Placement' },
            { slot: 'recorded_signal_types', label: 'Signals' },
        ],
        links: ACQUISITION_LINKS,
    },
    PET: {
        about: [
            [
                '$modality',
                [' with ', '$tracer_name', [' (', '$tracer_radionuclide', ')']],
                [', ', '$mode_of_administration'],
                [', ', '$scan_type', ' scan'],
                [', uptake ', '$uptake_time_seconds', ' s'],
                [', voxels ', { slot: 'reconstructed_voxel_size_mm', join: ' × ' }, ' mm'],
                [', resolution ', { slot: 'spatial_resolution_mm', join: ' × ' }, ' mm'],
                [', in ', '$image_units'],
                ...ACQUISITION_TAIL,
                '.',
            ],
        ],
        links: ACQUISITION_LINKS,
    },
    OtherModality: {
        about: [['$modality_label', [' (', '$modality', ')'], ...ACQUISITION_TAIL, '.']],
        rows: [{ slot: 'reason_no_modality_class_used', label: 'Why no class' }],
        links: ACQUISITION_LINKS,
    },
    Preprocessing: {
        about: [[['run in ', '$software'], [', smoothed at ', '$smoothing_fwhm_mm', ' mm FWHM'], '.']],
        rows: ['description', 'steps'],
    },
    ModelEstimation: {
        about: [
            [
                ['$stage', '-level '],
                '$model_family',
                [' (', '$model_type', ')'],
                [' by ', '$spatial_unit'],
                [', estimated with ', '$estimator'],
                [' in ', '$software'],
                [', HRF ', '$hrf_model'],
                '.',
            ],
        ],
        rows: [{ slot: 'model_settings', label: 'Settings' }],
        links: [
            { label: 'preprocessing', slot: 'preprocessing' },
            { label: 'inputs from', slot: 'inputs_from', verb: 'takes inputs from' },
        ],
        children: [{ label: 'terms', entityClass: 'ModelTerm' }],
    },
    ModelTerm: {
        about: [
            [
                ['$type', ' '],
                'term',
                [' varying ', '$variation_level'],
                [', ', '$functional_form'],
                [', in ', '$unit'],
                '.',
            ],
        ],
        rows: ['levels', { slot: 'source_definition', label: 'Definition' }],
        links: [
            { label: 'assessment', slot: 'assessment' },
            { label: 'region', slot: 'region' },
            { label: 'interacts with', slot: 'interaction_with', verb: 'interacts with' },
        ],
    },
    InferenceSettings: {
        about: [
            [
                ['$inference_level', '-level '],
                'inference',
                [' at ', '$height_threshold_type', ' < ', '$height_threshold_value'],
                [', clusters of ', '$cluster_extent_threshold', ' or more'],
                [', cluster p < ', '$clusterwise_threshold_value'],
                [', corrected by ', '$multiple_comparison_method'],
                [' over ', '$correction_scope'],
                [', α ', '$alpha_level'],
                [', ', '$permutation_count', ' permutations'],
                [', ', '$number_of_tests', ' tests'],
                ['; TFCE: ', '$tfce_used'],
                '.',
            ],
        ],
        rows: [
            'search_volume',
            { slot: 'neighborhood_definition', label: 'Neighbourhood' },
            { slot: 'tfce_parameters', label: 'TFCE parameters' },
        ],
        links: [{ label: 'correction regions', slot: 'correction_regions' }],
    },
    Measure: {
        about: [['$type', [' (', '$family', ')'], [', ', '$specific_metric'], [', in ', '$unit'], '.']],
    },
    Table: {
        about: [[['$table_number', ' '], [', ', '$purpose'], '.']],
        rows: ['title', 'caption', 'footer', 'column_headings', 'description'],
    },
    CoordinateSet: {
        about: [
            [
                ['$role', ' '],
                'coordinates',
                [' of a ', '$result_kind', ' result'],
                [', anchored at a ', '$anchor_kind'],
                '.',
            ],
        ],
        rows: ['description'],
        links: [
            { label: 'analysis', slot: 'analysis' },
            { label: 'regions', slot: 'regions' },
        ],
    },
    Analysis: {
        about: [
            [
                ['$prespecification', ' '],
                ['$effect.kind', ' '],
                'analysis',
                [' with ', '$outcome'],
                [' across ', '$spatial_scope'],
                [
                    ', tested with ',
                    '$effect.statistic.family',
                    [
                        ' (df ',
                        {
                            join: ', ',
                            parts: [
                                '$effect.statistic.degrees_of_freedom_numerator',
                                '$effect.statistic.degrees_of_freedom_denominator',
                            ],
                        },
                        ')',
                    ],
                ],
                [', ', '$effect.mediation.path', ' mediation path'],
                [', in ', '$coordinate_space', ' space'],
                '.',
            ],
        ],
        pairs: [
            'details.decoded_variable',
            'details.connectivity_method',
            'details.inference_target',
            'details.similarity_metric',
            'details.null_hypothesis',
            'details.implementation',
            'details.method',
            'details.second_block',
            'details.component_id',
            'details.component_label',
            'details.total_components',
            'details.variance_explained_percent',
            'details.crossblock_covariance_percent',
            'details.map_quantity',
            'details.polarity_semantics',
            'details.reason',
            'details.method_label',
        ],
        rows: [
            'definition',
            'interpretations',
            { slot: 'details.classes', label: 'Classes' },
            { slot: 'details.performance_metrics', label: 'Performance' },
            { slot: 'details.validation_scheme', label: 'Validation' },
            { slot: 'details.generalization', label: 'Generalization' },
            { slot: 'details.model', label: 'Model' },
            { slot: 'details.neural_representation', label: 'Representation' },
            { slot: 'details.competing_models', label: 'Competing models' },
            { slot: 'details.edges', label: 'Edges' },
            { slot: 'details.modulatory_input', label: 'Modulatory input' },
            { slot: 'details.components', label: 'Components' },
            { slot: 'details.second_block_detail', label: 'Second block' },
            { slot: 'details.dimensionality_selection_method', label: 'Dimensionality' },
            { slot: 'details.selection_criterion', label: 'Selection' },
            { slot: 'details.salience_threshold', label: 'Salience threshold' },
            { slot: 'details.explanation', label: 'Explanation' },
            { slot: 'details.structured_details', label: 'Details' },
            { slot: 'details.reason_first_class_type_not_used', label: 'Why other' },
            'source_table_analysis',
            { slot: 'model_representation_notes', label: 'Model notes' },
        ],
        links: [
            { label: 'measure', slot: 'measure' },
            { label: 'mediator', slot: 'effect.mediation.mediator' },
            { label: 'groups', slot: 'groups' },
            { label: 'model', slot: 'model_estimation' },
            { label: 'inference', slot: 'inference_settings' },
            { label: 'regions', slot: 'regions' },
            { label: 'defines', slot: 'defines_regions', verb: 'defines' },
            { label: 'seeds', slot: 'details.seed_regions' },
            { label: 'targets', slot: 'details.target_regions' },
            { label: 'second block', slot: 'details.second_block_assessments' },
            { label: 'acquisitions', slot: 'acquisitions' },
            { label: 'tasks', slot: 'tasks' },
            { label: 'assessments', slot: 'assessments' },
            { label: 'tables', slot: 'tables' },
            { label: 'mirror of', slot: 'mirror_of', verb: 'mirrors' },
        ],
    },
};

/** Every slot path a template names. */
export function templatePaths(template: CardTemplate): string[] {
    const inPhrase = (phrase: Phrase): string[] => {
        if (typeof phrase === 'string') return phrase.startsWith('$') ? [phrase.slice(1)] : [];
        if (Array.isArray(phrase)) return phrase.flatMap(inPhrase);
        if ('parts' in phrase) return phrase.parts.flatMap(inPhrase);
        if ('range' in phrase)
            return [
                ...(phrase.centre === undefined ? [] : inPhrase(phrase.centre)),
                ...phrase.range,
                ...(phrase.unit === undefined ? [] : [phrase.unit]),
            ];
        return [phrase.slot];
    };
    return [
        ...template.about.flatMap((sentence) => sentence.flatMap(inPhrase)),
        ...(template.pairs ?? []),
        ...(template.rows ?? []).map((spec) => (typeof spec === 'string' ? spec : spec.slot)),
        ...(template.links ?? []).map((spec) => spec.slot),
    ];
}

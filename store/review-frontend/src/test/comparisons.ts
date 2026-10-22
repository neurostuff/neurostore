import type { ReviewBundle } from '../contract/generated/review-bundle';
import { entityRows, ev, makeBundle, notReported, row } from './bundles';

/** A synthetic paper whose analyses compare terms in each of the shapes real records take. */
export const COMPARISON_TEXT =
    'Patients differed from controls on the drug at low stakes. Wide angles exceeded narrow ones in the first group.';
export const at = (words: string): [number, number] => [
    COMPARISON_TEXT.indexOf(words),
    COMPARISON_TEXT.indexOf(words) + words.length,
];

const TERMS: [string, string, 'categorical' | 'continuous' | null][] = [
    ['trm_status', 'status', 'categorical'],
    ['trm_drug', 'drug', 'categorical'],
    ['trm_choice', 'choice', 'categorical'],
    ['trm_group', 'group', 'categorical'],
    ['trm_angle', 'angle', 'categorical'],
    ['trm_inversion', 'inversion', 'categorical'],
    ['trm_cue', 'cue', 'categorical'],
    ['trm_onset', 'onset', 'categorical'],
    ['trm_score_a', 'score A', 'continuous'],
    ['trm_score_b', 'score B', 'continuous'],
    ['trm_score_c', 'score C', 'continuous'],
    ['trm_score_d', 'score D', 'continuous'],
    ['trm_untyped', 'untyped score', null],
];

type Sign = 'positive' | 'negative' | 'held' | 'undirected' | null;

/** A cell of `term`: its level (none for a continuous term) and its direction, unreported where `sign` is null. */
export const cell = (term: string, level: string | null, sign: Sign, spans: [number, number][] = []) => ({
    term,
    ...(level === null ? {} : { level: ev(level, spans) }),
    direction: sign === null ? notReported('undetermined') : ev(sign, spans),
});

const analysis = (local_id: string, name: string, kind: string | null, cells: ReturnType<typeof cell>[]) => ({
    local_id,
    name: ev(name),
    effect: { cells, ...(kind ? { kind: ev(kind) } : {}), statistic: { family: ev('t') } },
});

export const ANALYSES = [
    analysis('a_held', 'Pos versus Neg on the drug at low stakes', 'contrast', [
        cell('trm_status', 'Pos', 'positive', [at('Patients')]),
        cell('trm_status', 'Neg', 'negative', [at('controls')]),
        cell('trm_drug', 'On', 'held'),
        cell('trm_choice', 'Low', 'held'),
    ]),
    analysis('a_inter', 'G1 > G2 by angle', 'interaction', [
        cell('trm_group', 'G1', 'positive'),
        cell('trm_group', 'G2', 'negative', [at('first group')]),
        cell('trm_angle', 'Wide', 'positive', [at('Wide angles')]),
        cell('trm_angle', 'Narrow', 'negative', [at('narrow ones')]),
        cell('trm_inversion', 'Same', 'held'),
    ]),
    analysis('a_many', 'All onsets, G1 > G2', 'interaction', [
        cell('trm_group', 'G1', 'positive'),
        cell('trm_group', 'G2', 'negative'),
        ...['On1', 'On3', 'On5', 'On7'].map((level) => cell('trm_onset', level, 'positive')),
        ...['On2', 'On4', 'On6', 'On8'].map((level) => cell('trm_onset', level, 'negative')),
    ]),
    analysis('a_multi', 'CueA and CueB over CueC', 'contrast', [
        cell('trm_cue', 'CueA', 'positive'),
        cell('trm_cue', 'CueB', 'positive'),
        cell('trm_cue', 'CueC', 'negative'),
    ]),
    analysis('a_omni', 'status by drug by choice', 'omnibus', [
        cell('trm_status', 'Pos', 'undirected'),
        cell('trm_status', 'Neg', 'undirected'),
        cell('trm_drug', 'On', 'undirected'),
        cell('trm_drug', 'Off', 'undirected'),
        cell('trm_choice', 'Low', 'undirected'),
        cell('trm_choice', 'Mid', 'undirected'),
        cell('trm_choice', 'High', 'undirected'),
    ]),
    analysis(
        'a_reg',
        'Scores and the brain',
        'cross_subject_regression',
        ['trm_score_a', 'trm_score_b', 'trm_score_c', 'trm_score_d'].map((term) => cell(term, null, null))
    ),
    analysis('a_mod', 'Two scores', 'parametric_modulation', [
        cell('trm_score_a', null, 'positive'),
        cell('trm_score_b', null, 'negative'),
    ]),
    analysis('a_mixed', 'Neg first, then held, then Pos', 'contrast', [
        cell('trm_status', 'Neg', 'negative'),
        cell('trm_drug', 'On', 'held'),
        cell('trm_status', 'Pos', 'positive'),
    ]),
    analysis('a_either', 'A score either way, and one untyped', 'parametric_modulation', [
        cell('trm_score_c', null, 'undirected'),
        cell('trm_untyped', null, 'positive'),
    ]),
    analysis('a_simple', 'Pos alone', 'simple_effect', [cell('trm_status', 'Pos', 'positive')]),
    analysis('a_simple_less', 'Neg alone', 'simple_effect', [cell('trm_status', 'Neg', 'negative')]),
    analysis('a_nokind', 'Unsaid', null, [
        cell('trm_status', 'Pos', 'positive'),
        cell('trm_status', 'Neg', 'negative'),
    ]),
    analysis('a_unsigned', 'Pos over an unsigned Neg', 'contrast', [
        cell('trm_status', 'Pos', 'positive'),
        cell('trm_status', 'Neg', null),
    ]),
];

export const comparisonRecord = {
    groups: [{ local_id: 'grp_a', name: ev('Patients', [at('Patients')]) }],
    model_estimations: [
        {
            local_id: 'mdl_1',
            terms: TERMS.map(([local_id, name, type]) => ({
                local_id,
                name: ev(name),
                ...(type ? { type: ev(type) } : {}),
            })),
        },
    ],
    analyses: ANALYSES,
};

export const comparisonEntities = entityRows(
    row('grp_a', 'Group', 'groups'),
    row('mdl_1', 'ModelEstimation', 'model_estimations'),
    ...TERMS.map(([id]) => row(id, 'ModelTerm', 'terms', { parent: 'mdl_1' })),
    ...ANALYSES.map(({ local_id }) => row(local_id, 'Analysis', 'analyses'))
);

export const comparisonBundle = (overrides: Partial<ReviewBundle> = {}) =>
    makeBundle(comparisonRecord, COMPARISON_TEXT, { entities: comparisonEntities, ...overrides });

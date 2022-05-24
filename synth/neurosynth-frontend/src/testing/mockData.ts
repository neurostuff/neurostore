import { StudysetReturn, StudyReturn, PointReturn } from '../neurostore-typescript-sdk';
import { AnalysisApiResponse, AnnotationsApiResponse, ConditionApiResponse } from '../utils/api';

const mockConditions: () => ConditionApiResponse[] = () => [
    {
        name: 'mock-condition-name-1',
        description: 'mock-condition-description-1',
        id: 'mock-condition-id-1',
        created_at: '',
        user: 'github|user-1',
    },
    {
        name: 'mock-condition-name-2',
        description: 'mock-condition-description-2',
        id: 'mock-condition-id-2',
        created_at: '',
        user: 'github|user-1',
    },
];

const mockWeights: () => number[] = () => [1, 1];

const mockPoints: () => PointReturn[] = () => [
    {
        analysis: '3MXg8tfRq2sh',
        coordinates: [12.0, -18.0, 22.0],
        created_at: '2021-11-10T19:46:43.510565+00:00',
        id: '7vVqmHtGtnkQ',
        image: null,
        kind: 'unknown',
        label_id: null,
        space: 'MNI',
        user: 'some-user',
        value: [],
        entities: [],
    },
    {
        analysis: '3MXg8tfRq2sh',
        coordinates: [-40.0, -68.0, -20.0],
        created_at: '2021-11-10T19:46:43.510565+00:00',
        id: '3fZJuzbqti5v',
        image: null,
        kind: 'unknown',
        label_id: null,
        space: 'MNI',
        user: 'some-user',
        value: [],
        entities: [],
    },
    {
        analysis: '3MXg8tfRq2sh',
        coordinates: [-10.0, -60.0, 18.0],
        created_at: '2021-11-10T19:46:43.510565+00:00',
        id: '47aqyStcBEsC',
        image: null,
        kind: 'unknown',
        label_id: null,
        space: 'MNI',
        user: 'some-user',
        value: [],
        entities: [],
    },
];

const mockAnalyses: () => AnalysisApiResponse[] = () => [
    {
        conditions: mockConditions(),
        created_at: '2021-11-10T19:46:43.510565+00:00',
        description: null,
        id: '3MXg8tfRq2sh',
        images: [],
        name: '41544',
        points: mockPoints(),
        study: '4nz6aH7M59k2',
        user: 'some-user',
        weights: mockWeights(),
    },
    {
        conditions: [],
        created_at: '2021-11-10T19:46:43.510565+00:00',
        description: null,
        id: '6iaKVRHx8F9i',
        images: [],
        name: '41545',
        points: [],
        study: '4nz6aH7M59k2',
        user: 'some-user',
        weights: [],
    },
];

const mockStudysets: () => StudysetReturn[] = () => [
    {
        created_at: '2022-04-28T16:39:36.134359+00:00',
        id: '4eTAChpnL3Tg',
        neurostore_id: '4gUL3Zj2Kb7S',
        snapshot: null,
        updated_at: null,
        user: null,
        name: 'studyset-name-1',
        description: 'studyset-description-1',
    },
    {
        created_at: '2022-04-28T16:39:36.134359+00:00',
        id: '3JRewi4ND7rq',
        neurostore_id: 'wXQ9Fxw3mPz3',
        snapshot: null,
        updated_at: null,
        user: null,
        name: 'studyset-name-2',
        description: 'studyset-description-2',
    },
    {
        created_at: '2022-04-28T16:39:36.134359+00:00',
        id: '88oi5AKK8aJN',
        neurostore_id: 'M8VRV2ZKMHh2',
        snapshot: null,
        updated_at: null,
        user: null,
        name: 'studyset-name-3',
        description: 'studyset-description-3',
    },
];

const mockAnnotations: () => AnnotationsApiResponse[] = () => [
    {
        description: 'this is an annotation',
        user: 'github|26612023',
        name: 'choose this annotation',
        studyset: '7RWXkc9DHraB',
        updated_at: '2022-04-28T16:26:00.629711+00:00',
        source: null,
        source_id: null,
        note_keys: {
            inclusion_col: 'boolean',
            aergegr: 'number',
            aberg: 'string',
        },
        metadata: null,
        id: '62RUsQpwdouU',
        source_updated_at: null,
        created_at: '2022-04-28T16:25:16.431054+00:00',
        notes: [
            {
                authors:
                    'Dierks T, Linden DE, Jandl M, Formisano E, Goebel R, Lanfermann H, Singer W',
                analysis: '7eEjbzRmX6wv',
                study_name: "Activation of Heschl's gyrus during auditory hallucinations.",
                note: {
                    inclusion_col: true,
                    aergegr: 1234634,
                    aberg: 'aeraerg',
                },
                study_year: 1999,
                study: '4PBKSMmuUmu6',
                publication: 'Neuron',
                analysis_name: '35712',
            },
            {
                authors:
                    'Dierks T, Linden DE, Jandl M, Formisano E, Goebel R, Lanfermann H, Singer W',
                analysis: '5V3pSFxGqYFm',
                study_name: "Activation of Heschl's gyrus during auditory hallucinations.",
                note: {
                    inclusion_col: true,
                    aergegr: 1234634,
                    aberg: 'aeraerg',
                },
                study_year: 1999,
                study: '4PBKSMmuUmu6',
                publication: 'Neuron',
                analysis_name: '35713',
            },
            {
                authors:
                    'Jueptner M, Stephan KM, Frith CD, Brooks DJ, Frackowiak RS, Passingham RE',
                analysis: '5CUdzgAYKk5h',
                study_name: 'Anatomy of motor learning. I. Frontal cortex and attention to action.',
                note: {
                    inclusion_col: true,
                    aergegr: 1234634,
                    aberg: 'aeraerg',
                },
                study_year: 1997,
                study: '6be2ke4duJvg',
                publication: 'Journal of neurophysiology',
                analysis_name: '26997',
            },
            {
                authors:
                    'Jueptner M, Stephan KM, Frith CD, Brooks DJ, Frackowiak RS, Passingham RE',
                analysis: '3eoGBDLj43ih',
                study_name: 'Anatomy of motor learning. I. Frontal cortex and attention to action.',
                note: {
                    inclusion_col: true,
                    aergegr: 1234634,
                    aberg: 'aeraerg',
                },
                study_year: 1997,
                study: '6be2ke4duJvg',
                publication: 'Journal of neurophysiology',
                analysis_name: '26998',
            },
            {
                authors: 'Peterson BS, Skudlarski P, Gatenby JC, Zhang H, Anderson AW, Gore JC',
                analysis: '6fCoexBvSu2m',
                study_name:
                    'An fMRI study of Stroop word-color interference: evidence for cingulate subregions subserving multiple distributed attentional systems.',
                note: {
                    inclusion_col: true,
                    aergegr: 1234634,
                    aberg: 'aeraerg',
                },
                study_year: 1999,
                study: 'DcRHerjPxKYb',
                publication: 'Biological psychiatry',
                analysis_name: '14646',
            },
        ],
    },
];

const mockStudy: () => StudyReturn = () => ({
    source: 'neurostore',
    source_id: '7f66YLxzjPKk',
    doi: 'NaN',
    name: 'Amygdala-hippocampal involvement in human aversive trace conditioning revealed through event-related functional magnetic resonance imaging.',
    authors: 'Buchel C, Dolan RJ, Armony JL, Friston KJ',
    id: '4ZhkLTH8k2P6',
    user: 'github|26612023',
    updated_at: null,
    source_updated_at: '2022-04-28T16:23:11.548030+00:00',
    publication:
        'The Journal of neuroscience : the official journal of the Society for Neuroscience',
    created_at: '2022-05-18T19:38:15.262996+00:00',
    analyses: mockAnalyses(),
    description: null,
    year: 1999,
    metadata: null,
    pmid: '10594068',
});

export {
    mockConditions,
    mockWeights,
    mockAnalyses,
    mockStudysets,
    mockAnnotations,
    mockStudy,
    mockPoints,
};

import type { OpResult } from '../api/reviewApi';
import type { ReviewBundle } from '../contract/generated/review-bundle';
import type { Op } from '../contract/generated/review-ops';
import type { CoordinateAnalysis, CoordinatePoint } from '../model/coordinates';
import { entityRows, ev, makeBundle, row } from './bundles';

/** A paper with two tables and a sentence of coordinates, its parse, and hand-made revisions for op results. */
export const COORD_TEXT = [
    'Paper title\n',
    '## Results\n',
    'The precuneus peaked at x = 4, y = -60, z = 40 in the localizer.\n',
    'Table 1\n',
    'Region\tx\ty\tz\tt\n',
    'Precuneus\t4\t−60\t40\t5.1\n',
    'Insula\t-36\t20\t2\t4.2\n',
    'Cuneus\t10\t-80\t12\t3.3\n',
    '\n',
    'Table 2\n',
    'Contrast\tresult\n',
    'Faces > Scrambled\tn.s.\n',
].join('');

export const span = (phrase: string) => {
    const start = COORD_TEXT.indexOf(phrase);
    return { start_char: start, end_char: start + phrase.length };
};

export const key = (n: number) => `analysis#${n.toString(16).padStart(16, '0')}`;

export const point = (
    coordinates: [number, number, number],
    extra: Partial<CoordinatePoint> = {}
): CoordinatePoint => ({
    coordinates,
    ...extra,
});

export const PRECUNEUS = point([4, -60, 40], { values: [{ kind: 't', value: 5.1 }], label: 'Precuneus' });
export const INSULA = point([-36, 20, 2], { values: [{ kind: 't', value: 4.2 }], cluster_size: 12 });
export const CUNEUS = point([10, -80, 12], { values: [{ kind: 't', value: 3.3 }] });

export const FACES: CoordinateAnalysis = {
    key: key(0xa1),
    origin: 'table',
    table_id: 't1',
    name: 'Faces > Houses',
    role: 'result',
    coordinate_space: 'MNI',
    cells: [],
    points: [PRECUNEUS, INSULA],
};
export const HOUSES: CoordinateAnalysis = {
    key: key(0xb2),
    origin: 'table',
    table_id: 't1',
    name: 'Houses > Faces',
    role: 'result',
    coordinate_space: 'MNI',
    cells: [],
    points: [CUNEUS],
};
export const LOCALIZER: CoordinateAnalysis = {
    key: key(0xc3),
    origin: 'text',
    text_spans: [span('x = 4, y = -60, z = 40')],
    name: 'Precuneus localizer',
    role: 'anchor',
    coordinate_space: 'MNI',
    points: [point([4, -60, 40], { text_span: span('x = 4, y = -60, z = 40') })],
};
export const SCRAMBLED: CoordinateAnalysis = {
    key: key(0xd4),
    origin: 'table',
    table_id: 't2',
    name: 'Faces > Scrambled',
    role: 'result',
    cells: [],
    points: [],
};

export const PARSE: { analyses: CoordinateAnalysis[] } = { analyses: [FACES, HOUSES, LOCALIZER, SCRAMBLED] };

export const REVIEW = {
    id: 'r1',
    user_id: 'u1',
    state: 'in_progress',
    last_seq: 0,
    provenance: {},
    annotations: {},
} as const;

/** The record's analyses, each naming its coordinate analysis; the first mirrors the second. */
export const RECORD = {
    analyses: [
        {
            local_id: 'ana_faces',
            name: ev('Faces > Houses'),
            source_table_analysis: ev(FACES.key),
            mirror_of: 'ana_houses',
        },
        { local_id: 'ana_houses', name: ev('Houses > Faces'), source_table_analysis: ev(HOUSES.key) },
    ],
};
export const ENTITIES = entityRows(row('ana_faces', 'Analysis', 'analyses'), row('ana_houses', 'Analysis', 'analyses'));

export function coordinateBundle(overrides: Partial<ReviewBundle> = {}): ReviewBundle {
    return makeBundle(RECORD, COORD_TEXT, {
        entities: ENTITIES,
        parsed_paper: {
            bibliography: { title: 'Paper title' },
            tables: [
                { table_id: 't1', label: 'Table 1' },
                { table_id: 't2', label: 'Table 2' },
            ],
        },
        coordinate_parse: PARSE as ReviewBundle['coordinate_parse'],
        review: { ...REVIEW },
        ...overrides,
    });
}

/** A revision of PARSE holding `analyses`, as the server materializes it; verdicts are left to the server. */
export const revision = (analyses: CoordinateAnalysis[]) => ({ ...PARSE, revision_of: 'parse-1', analyses });

/** The answer to `sent`, carrying `analyses` as the revision, with the record, entity index and each op's after the server gives. */
export function coordinateResult(
    sent: Op[],
    analyses: CoordinateAnalysis[],
    {
        provenance = {},
        record = RECORD,
        entities = ENTITIES,
        after = {},
    }: {
        provenance?: Record<string, unknown>;
        record?: Record<string, unknown>;
        entities?: ReviewBundle['entities'];
        after?: Record<string, unknown>;
    } = {}
): OpResult {
    return {
        ops: sent.map((op, i) => ({ seq: i + 1, op, before: {}, after, user_id: 'u1', created_at: 'then' })),
        last_seq: sent.length,
        record: { local_id: 'P1', ...record },
        coordinate_revision: revision(analyses),
        provenance,
        annotations: {},
        hidden: { analyses: [], entities: [] },
        entities,
    };
}

/** A paper whose one analysis is read from a sentence, with no spans of its own, as the producer emits it. */
export const PROSE_TEXT = [
    'Title\n',
    '## Results\n',
    'There was an effect of diagnosis: peak coordinate in MNI space: X = 26, Y = − 8, Z = 0; p = 0.022.\n',
    'We did not find other effects.\n',
    '## Discussion\n',
    'The putamen matters.\n',
].join('');
export const proseAt = (phrase: string): [number, number] => [
    PROSE_TEXT.indexOf(phrase),
    PROSE_TEXT.indexOf(phrase) + phrase.length,
];
export const PROSE_SENTENCE = proseAt(
    'There was an effect of diagnosis: peak coordinate in MNI space: X = 26, Y = − 8, Z = 0; p = 0.022.'
);
export const PROSE_OTHER = proseAt('We did not find other effects.');

export const PROSE: CoordinateAnalysis = {
    key: key(0x7e),
    origin: 'text',
    name: 'SAD > HC',
    role: 'result',
    coordinate_space: 'MNI',
    points: [point([26, -8, 0])],
};

export function proseBundle({
    sets = true,
    named = true,
    nameSpans = true,
    coordinates = PROSE.points![0].coordinates,
} = {}) {
    const analysis = { ...PROSE, points: [point(coordinates)] };
    const record = {
        analyses: named
            ? [
                  {
                      local_id: 'a_prose',
                      name: ev('SAD > HC', nameSpans ? [PROSE_OTHER] : []),
                      source_table_analysis: ev(PROSE.key),
                  },
              ]
            : [],
        coordinate_sets: sets ? [{ local_id: PROSE.key, role: ev('result', [PROSE_SENTENCE], 'generated') }] : [],
    };
    return makeBundle(record, PROSE_TEXT, {
        entities: entityRows(
            ...(named ? [row('a_prose', 'Analysis', 'analyses')] : []),
            ...(sets ? [row(PROSE.key, 'CoordinateSet', 'coordinate_sets')] : [])
        ),
        coordinate_parse: { analyses: [analysis] } as ReviewBundle['coordinate_parse'],
        review: { ...REVIEW },
    });
}

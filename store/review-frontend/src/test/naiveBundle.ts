import type { ReviewBundle } from '../contract/generated/review-bundle';
import { entityRows, ev, makeBundle, row } from './bundles';

/** The synthetic paper of the naive-user end-to-end path: two groups and one analysis, no coordinates. */
export const NAIVE_TEXT =
    'We scanned 251 SAD-patients and 213 HC-participants. ' +
    'SAD-patients (n = 174) had larger putamen volume than HC-participants. ' +
    'Mean age was 31.2 years.';

const at = (words: string): [number, number] => [NAIVE_TEXT.indexOf(words), NAIVE_TEXT.indexOf(words) + words.length];

export function naiveBundle(overrides: Partial<ReviewBundle> = {}): ReviewBundle {
    return makeBundle(
        {
            groups: [
                {
                    local_id: 'grp_sad',
                    name: ev('SAD-patients', [at('251 SAD-patients')]),
                    acquired_count: ev(251, [at('251')]),
                    age_mean: ev(31.2, [at('31.2 years')], 'generated'),
                },
                { local_id: 'grp_hc', name: ev('HC-participants', [at('213 HC-participants')]) },
            ],
            analyses: [
                {
                    local_id: 'ana_1',
                    name: ev('SAD > HC', [at('larger putamen volume')]),
                    groups: [{ group: 'grp_sad', n: ev(174, [at('n = 174')]) }],
                },
            ],
        },
        NAIVE_TEXT,
        {
            source: {
                id: 'P2',
                base_study_id: 'P2',
                label: 'Grey matter in social anxiety',
                origin: 'upload',
                text_sha256: '0'.repeat(64),
                schema_versions: { paper_parse: '0.8.0', extraction: 'test' },
            },
            entities: entityRows(
                row('grp_sad', 'Group', 'groups'),
                row('grp_hc', 'Group', 'groups'),
                row('ana_1', 'Analysis', 'analyses')
            ),
            ...overrides,
        }
    );
}

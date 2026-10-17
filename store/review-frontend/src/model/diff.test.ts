import type { ReviewBundle } from '../contract/generated/review-bundle';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { CUNEUS, FACES, HOUSES, key, LOCALIZER, PARSE, SCRAMBLED } from '../test/coordinates';
import type { CoordinateAnalysis, CoordinateParse } from './coordinates';
import { diffCoordinates } from './coordinateDiff';
import {
    analysisItemFor,
    diffRecords,
    diffTarget,
    isChange,
    nextChange,
    reviewDiff,
    visibleItems,
    type AnalysisDiff,
    type DiffItem,
    type DiffStatus,
} from './diff';
import type { Json } from './paths';
import { buildRecordIndex } from './record';

const TEXT = 'x'.repeat(200);
const NO_PROVENANCE = {};
const NONE: AnalysisDiff[] = [];

const ORIGINAL = {
    groups: [
        { local_id: 'grp_a', name: ev('Patients', [[10, 18]]), n: ev(20, [[20, 22]]) },
        { local_id: 'grp_b', name: ev('Controls', [[30, 38]]) },
    ],
    analyses: [
        { local_id: 'a_1', name: ev('Patients > Controls', [[40, 60]]), groups: [{ group: 'grp_a', n: ev(20) }] },
        { local_id: 'a_hidden', name: ev('Other', [[70, 75]]) },
    ],
    tasks: [{ local_id: 'tsk_1', name: ev('Stroop', [[80, 86]]) }],
};
const ROWS = entityRows(
    row('grp_a', 'Group', 'groups'),
    row('grp_b', 'Group', 'groups'),
    row('a_1', 'Analysis', 'analyses'),
    row('a_hidden', 'Analysis', 'analyses'),
    row('tsk_1', 'Task', 'tasks')
);
const HIDDEN = { analyses: ['a_hidden'], entities: [] };

function side(record: Json, entities: ReviewBundle['entities'] = ROWS) {
    const bundle = makeBundle(record, TEXT, { entities, hidden: HIDDEN });
    return { record: bundle.record as Json, index: buildRecordIndex(bundle) };
}

const ORIGINAL_SIDE = side(ORIGINAL);
const edited = (change: (record: Json) => Json, entities?: ReviewBundle['entities']) =>
    side(change(structuredClone(ORIGINAL) as Json), entities);
const byKey = (items: DiffItem[], key: string) => items.find((item) => item.key === key);
const changedKeys = (items: DiffItem[]) => items.filter((i) => i.status !== 'same').map((i) => i.key);

describe('the diff of a review against the original record', () => {
    it('finds every item the same when nothing changed', () => {
        const items = diffRecords(ORIGINAL_SIDE, side(structuredClone(ORIGINAL)));
        expect(items.length).toBeGreaterThan(0);
        expect(changedKeys(items)).toEqual([]);
    });

    it('marks an edited slot changed, with its value and evidence before and after, and its entity changed', () => {
        const review = edited((r) => {
            (r.groups as Json[])[0].n = ev(24, [[23, 25]]);
            return r;
        });
        const items = diffRecords(ORIGINAL_SIDE, review);
        expect(changedKeys(items)).toEqual(['entity:grp_a', 'slot:grp_a:n']);
        expect(byKey(items, 'slot:grp_a:n')).toMatchObject({
            kind: 'slot',
            status: 'changed',
            entity: 'grp_a',
            path: 'n',
            before: { value: 20 },
            after: { value: 24 },
            evidence: { before: [[20, 22]], after: [[23, 25]] },
        });
    });

    it('marks a slot changed when only its evidence moved', () => {
        const review = edited((r) => {
            (r.groups as Json[])[1].name = ev('Controls', [[31, 38]]);
            return r;
        });
        expect(byKey(diffRecords(ORIGINAL_SIDE, review), 'slot:grp_b:name')).toMatchObject({
            status: 'changed',
            evidence: { before: [[30, 38]], after: [[31, 38]] },
        });
    });

    it('marks an entity only the review has added, and one only the original has removed', () => {
        const review = edited(
            (r) => {
                r.groups = [(r.groups as Json[])[0], { local_id: 'grp_c', name: ev('Siblings') }];
                return r;
            },
            entityRows(
                row('grp_a', 'Group', 'groups'),
                row('grp_c', 'Group', 'groups'),
                row('a_1', 'Analysis', 'analyses'),
                row('a_hidden', 'Analysis', 'analyses'),
                row('tsk_1', 'Task', 'tasks')
            )
        );
        const items = diffRecords(ORIGINAL_SIDE, review);
        expect(byKey(items, 'entity:grp_c')).toMatchObject({ kind: 'entity', status: 'added' });
        expect(byKey(items, 'entity:grp_b')).toMatchObject({ kind: 'entity', status: 'removed' });
        expect(byKey(items, 'slot:grp_b:name')).toBeUndefined();
    });

    it('lines links up by entity, slot and target', () => {
        const review = edited((r) => {
            ((r.analyses as Json[])[0].groups as Json[])[0].group = 'grp_b';
            return r;
        });
        const items = diffRecords(ORIGINAL_SIDE, review);
        expect(byKey(items, 'relationship:a_1:groups[#0].group:grp_a')).toMatchObject({
            kind: 'relationship',
            status: 'removed',
        });
        expect(byKey(items, 'relationship:a_1:groups[#0].group:grp_b')).toMatchObject({
            kind: 'relationship',
            status: 'added',
            entity: 'a_1',
            path: 'groups[#0].group',
            target: 'grp_b',
        });
        expect(byKey(items, 'entity:a_1')?.status).toBe('changed');
    });

    it('marks the items of a hidden entity hidden', () => {
        const review = edited((r) => {
            const [, hidden] = r.analyses as Json[];
            hidden.name = ev('Another');
            hidden.groups = [{ group: 'grp_a' }];
            return r;
        });
        const items = diffRecords(ORIGINAL_SIDE, review);
        expect(byKey(items, 'slot:a_hidden:name')).toMatchObject({ status: 'changed', hidden: true });
        expect(byKey(items, 'entity:a_hidden')).toMatchObject({ status: 'changed', hidden: true });
        expect(byKey(items, 'relationship:a_hidden:groups[#0].group:grp_a')).toMatchObject({
            status: 'added',
            hidden: true,
        });
        expect(byKey(items, 'slot:a_1:name')?.hidden).toBe(false);
        expect(byKey(items, 'entity:a_1')?.hidden).toBe(false);
    });

    it('marks a slot only the review has added, and one only the original has removed', () => {
        const review = edited((r) => {
            const [one, two] = r.groups as Json[];
            one.n = undefined;
            two.n = ev(12);
            return r;
        });
        const items = diffRecords(ORIGINAL_SIDE, review);
        expect(byKey(items, 'slot:grp_a:n')).toMatchObject({ status: 'removed', before: { value: 20 } });
        expect(byKey(items, 'slot:grp_a:n')).not.toHaveProperty('after', expect.anything());
        expect(byKey(items, 'slot:grp_b:n')).toMatchObject({ status: 'added', after: { value: 12 } });
        expect(byKey(items, 'slot:grp_b:n')).not.toHaveProperty('before', expect.anything());
        expect(byKey(items, 'entity:grp_a')?.status).toBe('changed');
        expect(byKey(items, 'entity:grp_b')?.status).toBe('changed');
    });

    it('marks a slot changed when only the status of its evidence differs', () => {
        const original = side({
            ...ORIGINAL,
            groups: [
                { local_id: 'grp_a', n: { ...ev(20), evidence: { status: 'not_applicable' } } },
                ORIGINAL.groups[1],
            ],
        });
        const review = edited((r) => {
            (r.groups as Json[])[0] = { local_id: 'grp_a', n: ev(20) };
            return r;
        });
        expect(byKey(diffRecords(original, review), 'slot:grp_a:n')).toMatchObject({ status: 'changed' });
    });

    it('marks a slot changed when only the end of a span moved', () => {
        const review = edited((r) => {
            (r.groups as Json[])[0].n = ev(20, [[20, 23]]);
            return r;
        });
        expect(byKey(diffRecords(ORIGINAL_SIDE, review), 'slot:grp_a:n')?.status).toBe('changed');
    });

    it('keeps the diff of each record pair, so alternating pairs are each computed once', () => {
        const one = side(structuredClone(ORIGINAL));
        const two = side(structuredClone(ORIGINAL));
        const first = diffRecords(ORIGINAL_SIDE, one);
        expect(diffRecords(ORIGINAL_SIDE, two)).not.toBe(first);
        expect(diffRecords(ORIGINAL_SIDE, one)).toBe(first);
    });
});

const verdict = (analysis: CoordinateAnalysis, kind: string, replaced_by?: string[]) => ({
    key: analysis.key,
    verdict: kind,
    reason: 'unjudged',
    ...(replaced_by && { replaced_by }),
});
const revisionOf = (analyses: CoordinateAnalysis[], verdicts: object[]): CoordinateParse =>
    ({ ...PARSE, revision_of: 'parse-1', analyses, verdicts }) as CoordinateParse;
const analysisKey = (analysis: { key: string }) => `coordinate_analysis:${analysis.key}`;
const accepted = (...analyses: CoordinateAnalysis[]) => analyses.map((a) => verdict(a, 'accept'));

describe('the diff of the coordinate analyses against the original parse', () => {
    it('finds every analysis the same while there is no revision', () => {
        const items = diffCoordinates(PARSE, null, {});
        expect(items.map((i) => [i.key, i.status, i.change])).toEqual(
            PARSE.analyses.map((a) => [analysisKey(a), 'same', 'accept'])
        );
    });

    it('marks an analysis with no points hidden', () => {
        const items = diffCoordinates(PARSE, null, {});
        expect(byKey(items, analysisKey(SCRAMBLED))?.hidden).toBe(true);
        expect(byKey(items, analysisKey(FACES))?.hidden).toBe(false);
    });

    it('follows the revision’s verdicts: relabel, split, merge, omit and add', () => {
        const relabelled = { ...HOUSES, role: 'anchor' };
        const left = { ...FACES, key: key(0xe1), points: FACES.points!.slice(0, 1), derived_from: [FACES.key] };
        const right = { ...FACES, key: key(0xe2), points: FACES.points!.slice(1), derived_from: [FACES.key] };
        const added = {
            ...SCRAMBLED,
            key: key(0xf1),
            points: [{ coordinates: [1, 2, 3] as [number, number, number] }],
        };
        const revision = revisionOf(
            [left, right, relabelled, added],
            [
                verdict(FACES, 'split', [left.key, right.key]),
                verdict(HOUSES, 'relabel'),
                verdict(LOCALIZER, 'omit'),
                verdict(SCRAMBLED, 'omit'),
                { key: added.key, verdict: 'add', reason: 'reviewer add' },
            ]
        );
        const items = diffCoordinates(PARSE, revision, {});
        expect(byKey(items, analysisKey(FACES))).toMatchObject({
            status: 'changed',
            change: 'split',
            before: FACES,
            after: [left, right],
        });
        expect(byKey(items, analysisKey(HOUSES))).toMatchObject({
            status: 'changed',
            change: 'relabel',
            after: [relabelled],
        });
        expect(byKey(items, analysisKey(LOCALIZER))).toMatchObject({ status: 'removed', change: 'omit', after: [] });
        expect(byKey(items, analysisKey(added))).toMatchObject({ status: 'added', change: 'add', after: [added] });
        expect(byKey(items, analysisKey(SCRAMBLED))).toMatchObject({ status: 'removed', change: 'omit', after: [] });
        expect(items.filter((i) => i.status === 'added').map((i) => i.key)).toEqual([analysisKey(added)]);
        expect(items).toHaveLength(PARSE.analyses.length + 1);
    });

    it('marks merged originals changed, each with the merged analysis after', () => {
        const merged = {
            ...FACES,
            key: key(0xe3),
            points: [...FACES.points!, ...HOUSES.points!],
            derived_from: [FACES.key, HOUSES.key],
        };
        const revision = revisionOf(
            [merged, LOCALIZER, SCRAMBLED],
            [
                verdict(FACES, 'merge', [merged.key]),
                verdict(HOUSES, 'merge', [merged.key]),
                ...accepted(LOCALIZER, SCRAMBLED),
            ]
        );
        const items = diffCoordinates(PARSE, revision, {});
        expect(byKey(items, analysisKey(FACES))).toMatchObject({ change: 'merge', after: [merged] });
        expect(byKey(items, analysisKey(HOUSES))).toMatchObject({ change: 'merge', after: [merged] });
    });

    it('marks a point edit that keeps the key changed, as an edit', () => {
        const resized = { ...HOUSES, points: [{ ...HOUSES.points![0], cluster_size: 40 }] };
        const revision = revisionOf(
            [FACES, resized, LOCALIZER, SCRAMBLED],
            accepted(FACES, HOUSES, LOCALIZER, SCRAMBLED)
        );
        const items = diffCoordinates(PARSE, revision, {});
        expect(byKey(items, analysisKey(HOUSES))).toMatchObject({
            status: 'changed',
            change: 'edit',
            after: [resized],
        });
        expect(byKey(items, analysisKey(FACES))?.status).toBe('same');
    });

    it('marks an analysis the reviewer rejected removed, as export leaves it out', () => {
        const provenance = { [analysisKey(HOUSES)]: { state: 'removed' as const, user_id: 'u1', at: 'then' } };
        expect(byKey(diffCoordinates(PARSE, null, provenance), analysisKey(HOUSES))).toMatchObject({
            status: 'removed',
            change: 'reject',
        });
    });

    it('carries each analysis’s text spans as its evidence before and after', () => {
        expect(byKey(diffCoordinates(PARSE, null, {}), analysisKey(LOCALIZER))?.evidence).toEqual({
            before: [[LOCALIZER.text_spans![0].start_char, LOCALIZER.text_spans![0].end_char]],
            after: [[LOCALIZER.text_spans![0].start_char, LOCALIZER.text_spans![0].end_char]],
        });
    });
});

describe('the diff of the coordinate analyses against the revision the source was loaded with', () => {
    const left = { ...FACES, key: key(0xe1), points: FACES.points!.slice(0, 1), derived_from: [FACES.key] };
    const right = { ...FACES, key: key(0xe2), points: FACES.points!.slice(1), derived_from: [FACES.key] };
    const loaded = revisionOf(
        [left, right, HOUSES, LOCALIZER],
        [verdict(FACES, 'split', [left.key, right.key]), ...accepted(HOUSES, LOCALIZER), verdict(SCRAMBLED, 'omit')]
    );

    it('finds the pipeline’s analyses the same while the review has not changed them', () => {
        const items = diffCoordinates(loaded, loaded, {});
        expect(items.map((i) => [i.key, i.status, i.change])).toEqual(
            [left, right, HOUSES, LOCALIZER].map((a) => [analysisKey(a), 'same', 'accept'])
        );
    });

    it('marks what the review did to them: an edit of a part, a relabel, an omit and an add', () => {
        const moved = { ...left, key: key(0xe3), points: [{ coordinates: [1, 2, 3] as [number, number, number] }] };
        const relabelled = { ...HOUSES, role: 'anchor' };
        const added = {
            ...SCRAMBLED,
            key: key(0xf1),
            points: [{ coordinates: [4, 5, 6] as [number, number, number] }],
        };
        const revision = revisionOf([moved, right, relabelled, added], []);
        const items = diffCoordinates(loaded, revision, {});
        expect(items.map((i) => [i.key, i.status, i.change])).toEqual([
            [analysisKey(left), 'changed', 'edit'],
            [analysisKey(right), 'same', 'accept'],
            [analysisKey(HOUSES), 'changed', 'relabel'],
            [analysisKey(LOCALIZER), 'removed', 'omit'],
            [analysisKey(added), 'added', 'add'],
        ]);
        expect(byKey(items, analysisKey(left))).toMatchObject({ before: left, after: [moved] });
    });

    it('marks the pipeline’s parts merged back into one, and one part split again', () => {
        const merged = { ...FACES, key: key(0xe4), derived_from: [FACES.key] };
        const items = diffCoordinates(loaded, revisionOf([merged, HOUSES, LOCALIZER], []), {});
        expect(byKey(items, analysisKey(left))).toMatchObject({ change: 'merge', after: [merged] });
        expect(byKey(items, analysisKey(right))).toMatchObject({ change: 'merge', after: [merged] });
        const a = { ...right, key: key(0xe5) };
        const b = { ...right, key: key(0xe6) };
        const again = diffCoordinates(loaded, revisionOf([left, a, b, HOUSES, LOCALIZER], []), {});
        expect(byKey(again, analysisKey(right))).toMatchObject({ change: 'split', after: [a, b] });
    });
});

describe('the whole diff', () => {
    it('holds the record’s and the coordinates’ items, the shown ones apart, and the same object for the same parts', () => {
        const records = diffRecords(ORIGINAL_SIDE, side(structuredClone(ORIGINAL)));
        const coordinates = diffCoordinates(PARSE, null, {});
        const diff = reviewDiff(records, coordinates, NO_PROVENANCE);
        expect(diff.items).toEqual([...records, ...coordinates]);
        expect(diff.shown).toEqual(diff.items.filter((item) => !item.hidden));
        expect(diff.byKey.get('entity:grp_a')).toBe(byKey(records, 'entity:grp_a'));
        expect(reviewDiff(records, coordinates, NO_PROVENANCE)).toBe(diff);
    });
});

const splitOf = (analysis: CoordinateAnalysis, at: number) => {
    const points = analysis.points!;
    return [
        { ...analysis, key: key(at), points: points.slice(0, 1), derived_from: [analysis.key] },
        { ...analysis, key: key(at + 1), points: points.slice(1), derived_from: [analysis.key] },
    ];
};
const removedAt = (...analyses: { key: string }[]) =>
    Object.fromEntries(analyses.map((a) => [analysisKey(a), { state: 'removed' as const, user_id: 'u1', at: 'then' }]));

describe('the diff of the coordinate analyses: how a revision maps to the original', () => {
    it('does not list the products of a split or a merge as added', () => {
        const [left, right] = splitOf(FACES, 0xe1);
        const revision = revisionOf(
            [left, right, HOUSES, LOCALIZER, SCRAMBLED],
            [verdict(FACES, 'split', [left.key, right.key]), ...accepted(HOUSES, LOCALIZER, SCRAMBLED)]
        );
        const items = diffCoordinates(PARSE, revision, {});
        expect(items.filter((i) => i.status === 'added')).toEqual([]);
        expect(items).toHaveLength(PARSE.analyses.length);
    });

    it('rejects an analysis only when every analysis that replaces it is rejected', () => {
        const [left, right] = splitOf(FACES, 0xe1);
        const revision = revisionOf(
            [left, right, HOUSES, LOCALIZER, SCRAMBLED],
            [verdict(FACES, 'split', [left.key, right.key]), ...accepted(HOUSES, LOCALIZER, SCRAMBLED)]
        );
        expect(byKey(diffCoordinates(PARSE, revision, removedAt(left)), analysisKey(FACES))).toMatchObject({
            status: 'changed',
            change: 'split',
        });
        expect(byKey(diffCoordinates(PARSE, revision, removedAt(left, right)), analysisKey(FACES))).toMatchObject({
            status: 'removed',
            change: 'reject',
            after: [],
        });
    });

    it('marks an analysis the reviewer added and then rejected removed', () => {
        const added = { ...HOUSES, key: key(0xf1), derived_from: undefined };
        const revision = revisionOf(
            [FACES, HOUSES, LOCALIZER, SCRAMBLED, added],
            [...accepted(FACES, HOUSES, LOCALIZER, SCRAMBLED), { key: added.key, verdict: 'add', reason: 'x' }]
        );
        expect(byKey(diffCoordinates(PARSE, revision, {}), analysisKey(added))?.status).toBe('added');
        expect(byKey(diffCoordinates(PARSE, revision, removedAt(added)), analysisKey(added))).toMatchObject({
            status: 'removed',
            change: 'add',
        });
    });

    it('takes an original the revision lacks, with no verdict for it, as omitted, and one it holds as accepted', () => {
        const revision = { ...PARSE, revision_of: 'parse-1', analyses: [FACES, HOUSES, LOCALIZER] } as CoordinateParse;
        const items = diffCoordinates(PARSE, revision, {});
        expect(byKey(items, analysisKey(SCRAMBLED))).toMatchObject({ status: 'removed', change: 'omit' });
        expect(byKey(items, analysisKey(FACES))).toMatchObject({ status: 'same', change: 'accept' });
    });

    it('does not count where an analysis is derived from when it compares an accepted analysis with its original', () => {
        const derived = { ...HOUSES, derived_from: [FACES.key] };
        const revision = revisionOf(
            [FACES, derived, LOCALIZER, SCRAMBLED],
            accepted(FACES, HOUSES, LOCALIZER, SCRAMBLED)
        );
        expect(byKey(diffCoordinates(PARSE, revision, {}), analysisKey(HOUSES))).toMatchObject({
            status: 'same',
            change: 'accept',
        });
    });

    it('does not take an accepted analysis with several replacements as the same', () => {
        const extra = { ...HOUSES, key: key(0xf2), derived_from: [FACES.key] };
        const revision = revisionOf(
            [FACES, extra, HOUSES, LOCALIZER, SCRAMBLED],
            [
                { ...verdict(FACES, 'accept'), replaced_by: [FACES.key, extra.key] },
                ...accepted(HOUSES, LOCALIZER, SCRAMBLED),
            ]
        );
        expect(byKey(diffCoordinates(PARSE, revision, {}), analysisKey(FACES))).toMatchObject({
            status: 'changed',
            change: 'split',
            after: [FACES, extra],
        });
    });

    it('carries the text spans of an analysis’s points as its evidence, with those of the analysis itself', () => {
        const pointed = { ...HOUSES, points: [{ ...CUNEUS, text_span: { start_char: 5, end_char: 9 } }] };
        const parse = { analyses: [pointed] } as CoordinateParse;
        expect(byKey(diffCoordinates(parse, null, {}), analysisKey(pointed))?.evidence).toEqual({
            before: [[5, 9]],
            after: [[5, 9]],
        });
    });
});

describe('the status of a change', () => {
    it('is a change unless the item is the same', () => {
        const statuses: DiffStatus[] = ['same', 'changed', 'added', 'removed', 'rejected'];
        expect(statuses.map(isChange)).toEqual([false, true, true, true, true]);
    });
});

describe('a record item the reviewer rejected', () => {
    const rejected = (...keys: string[]) =>
        Object.fromEntries(keys.map((k) => [k, { state: 'removed' as const, user_id: 'u1', at: 'then' }]));
    const unchanged = diffRecords(ORIGINAL_SIDE, side(structuredClone(ORIGINAL)));

    it('shows as rejected, whether it is a slot, an entity or a relationship, though the record still holds it', () => {
        const diff = reviewDiff(
            unchanged,
            NONE,
            rejected('slot:grp_a:n', 'entity:grp_b', 'relationship:a_1:groups[#0].group:grp_a')
        );
        expect(diff.byKey.get('slot:grp_a:n')).toMatchObject({ kind: 'slot', status: 'rejected' });
        expect(diff.byKey.get('entity:grp_b')).toMatchObject({ kind: 'entity', status: 'rejected' });
        expect(diff.byKey.get('relationship:a_1:groups[#0].group:grp_a')).toMatchObject({
            kind: 'relationship',
            status: 'rejected',
        });
        expect(diff.items.filter((i) => i.status === 'rejected')).toHaveLength(3);
        expect(diff.shown.filter((i) => i.status === 'rejected')).toHaveLength(3);
    });

    it('leaves an item the review no longer holds removed', () => {
        const review = edited((r) => {
            (r.groups as Json[])[0].n = undefined;
            return r;
        });
        const items = diffRecords(ORIGINAL_SIDE, review);
        expect(reviewDiff(items, NONE, rejected('slot:grp_a:n')).byKey.get('slot:grp_a:n')?.status).toBe('removed');
    });

    it('keeps the same diff for the same records and provenance, and a new one for new provenance', () => {
        const provenance = rejected('slot:grp_a:n');
        const diff = reviewDiff(unchanged, NONE, provenance);
        expect(reviewDiff(unchanged, NONE, provenance)).toBe(diff);
        expect(reviewDiff(unchanged, NONE, rejected('slot:grp_a:n'))).not.toBe(diff);
        expect(reviewDiff(unchanged, NONE, {}).byKey.get('slot:grp_a:n')?.status).toBe('same');
    });
});

describe('where a diff item leads', () => {
    const edit = edited(
        (r) => {
            const [one] = r.groups as Json[];
            one.n = undefined;
            one.name = ev('Sick');
            r.groups = [one];
            ((r.analyses as Json[])[0].groups as Json[])[0].group = 'grp_b';
            return r;
        },
        entityRows(
            row('grp_a', 'Group', 'groups'),
            row('grp_b', 'Group', 'groups'),
            row('a_1', 'Analysis', 'analyses'),
            row('a_hidden', 'Analysis', 'analyses'),
            row('tsk_1', 'Task', 'tasks')
        )
    );
    const items = diffRecords(ORIGINAL_SIDE, edit);
    const target = (key: string) => diffTarget(byKey(items, key)!);

    it('is the slot for a slot, and for an entity the entity', () => {
        expect(target('slot:grp_a:name')).toEqual({ kind: 'slot', entity: 'grp_a', path: 'name' });
        expect(target('entity:grp_a')).toEqual({ kind: 'entity', entity: 'grp_a' });
    });

    it('is the entity for a slot the review lost', () => {
        expect(byKey(items, 'slot:grp_a:n')?.status).toBe('removed');
        expect(target('slot:grp_a:n')).toEqual({ kind: 'entity', entity: 'grp_a' });
    });

    it('is the link for a link, and for a removed link the slot that held it', () => {
        expect(target('relationship:a_1:groups[#0].group:grp_b')).toEqual({
            kind: 'relationship',
            entity: 'a_1',
            path: 'groups[#0].group',
            target_entity: 'grp_b',
        });
        expect(target('relationship:a_1:groups[#0].group:grp_a')).toEqual({
            kind: 'slot',
            entity: 'a_1',
            path: 'groups[#0].group',
        });
    });

    it('is nothing for an entity the review lacks', () => {
        const gone = diffRecords(
            ORIGINAL_SIDE,
            edited(
                (r) => ({ ...r, tasks: [] }),
                entityRows(
                    row('grp_a', 'Group', 'groups'),
                    row('grp_b', 'Group', 'groups'),
                    row('a_1', 'Analysis', 'analyses'),
                    row('a_hidden', 'Analysis', 'analyses')
                )
            )
        );
        const task = byKey(gone, 'entity:tsk_1')!;
        expect(task.status).toBe('removed');
        expect(diffTarget(task)).toBeNull();
    });

    it('is, for a rejected record item, where it would be if it were not', () => {
        const diff = reviewDiff(items, NONE, { 'entity:grp_a': { state: 'removed', user_id: 'u1', at: 'then' } });
        expect(diffTarget(diff.byKey.get('entity:grp_a')!)).toEqual({ kind: 'entity', entity: 'grp_a' });
    });

    it('is the first analysis that takes the place of an original, and nothing when none does', () => {
        const [left, right] = splitOf(FACES, 0xe1);
        const revision = revisionOf(
            [left, right, HOUSES, LOCALIZER],
            [verdict(FACES, 'split', [left.key, right.key]), ...accepted(HOUSES, LOCALIZER), verdict(SCRAMBLED, 'omit')]
        );
        const coordinates = diffCoordinates(PARSE, revision, {});
        expect(diffTarget(byKey(coordinates, analysisKey(FACES))!)).toEqual({
            kind: 'coordinate_analysis',
            analysis_key: left.key,
        });
        expect(diffTarget(byKey(coordinates, analysisKey(SCRAMBLED))!)).toBeNull();
    });
});

describe('finding the item of a coordinate analysis', () => {
    it('is the item under the original’s key, or under the key of an analysis that took its place', () => {
        const [left, right] = splitOf(FACES, 0xe1);
        const revision = revisionOf(
            [left, right, HOUSES, LOCALIZER, SCRAMBLED],
            [verdict(FACES, 'split', [left.key, right.key]), ...accepted(HOUSES, LOCALIZER, SCRAMBLED)]
        );
        const diff = reviewDiff([], diffCoordinates(PARSE, revision, {}), NO_PROVENANCE);
        const faces = byKey(diff.items, analysisKey(FACES));
        expect(analysisItemFor(diff, FACES.key)).toBe(faces);
        expect(analysisItemFor(diff, right.key)).toBe(faces);
        expect(analysisItemFor(diff, HOUSES.key)).toBe(byKey(diff.items, analysisKey(HOUSES)));
        expect(analysisItemFor(diff, 'analysis#nothing')).toBeUndefined();
    });
});

describe('stepping between changes', () => {
    const item = (key: string, status: DiffStatus, hidden = false) =>
        ({
            kind: 'slot',
            key,
            status,
            hidden,
            entity: 'e',
            path: key,
            evidence: { before: [], after: [] },
        }) as DiffItem;
    const items = [
        item('a', 'same'),
        item('b', 'changed'),
        item('c', 'same'),
        item('d', 'removed'),
        item('e', 'rejected'),
    ];
    const next = (focus: string, delta: 1 | -1, canFocus = () => true) =>
        nextChange(items, focus, undefined, delta, canFocus)?.key;

    it('goes to the next change after the focused one, and the previous one back', () => {
        expect(next('b', 1)).toBe('d');
        expect(next('d', 1)).toBe('e');
        expect(next('e', 1)).toBeUndefined();
        expect(next('e', -1)).toBe('d');
        expect(next('b', -1)).toBeUndefined();
    });

    it('goes from an item that is not a change to the first change after it, and back to the last one', () => {
        expect(next('nothing', 1)).toBe('b');
        expect(next('nothing', -1)).toBe('e');
    });

    it('goes on past the changes that cannot be focused', () => {
        expect(nextChange(items, 'b', undefined, 1, () => false)).toBeUndefined();
        expect(next('b', 1, () => false)).toBeUndefined();
        const only = (key: string) => key === 'e';
        expect(nextChange(items, 'b', undefined, 1, (i) => only(i.key))?.key).toBe('e');
        expect(nextChange(items, 'e', undefined, -1, (i) => i.key === 'b')?.key).toBe('b');
    });

    it('goes from the item of the focused analysis, whatever its key', () => {
        const analysis = { ...items[3], kind: 'analysis', change: 'omit', after: [] } as unknown as AnalysisDiff;
        const list = [...items.slice(0, 3), analysis, items[4]];
        expect(nextChange(list, 'x', analysis, 1, () => true)?.key).toBe('e');
    });

    it('lists the hidden items only when asked', () => {
        const diff = {
            items: [item('a', 'same'), item('h', 'changed', true)],
            shown: [item('a', 'same')],
            byKey: new Map(),
        };
        expect(visibleItems(diff, false)).toBe(diff.shown);
        expect(visibleItems(diff, true)).toBe(diff.items);
    });
});

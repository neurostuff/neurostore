import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { coordinateBundle, FACES, HOUSES, key, LOCALIZER, RECORD, revision, SCRAMBLED } from '../test/coordinates';
import type { Json } from '../model/paths';
import { selectDiff, selectOriginalSpans } from './diffSelectors';
import { createReviewStores } from './reviewStores';

const TEXT = '😀 We scanned twenty patients and twenty controls.';
const at = (word: string): [number, number] => {
    const start = [...TEXT.slice(0, TEXT.indexOf(word))].length;
    return [start, start + word.length];
};
const utf16 = (word: string): [number, number] => [TEXT.indexOf(word), TEXT.indexOf(word) + word.length];

const original = {
    groups: [
        { local_id: 'grp_a', name: ev('Patients', [at('patients')]), n: ev(20, [at('twenty')]) },
        { local_id: 'grp_b', name: ev('Controls', [at('controls')]) },
        { local_id: 'grp_c', name: ev('Others') },
    ],
};
const entities = entityRows(
    row('grp_a', 'Group', 'groups'),
    row('grp_b', 'Group', 'groups'),
    row('grp_c', 'Group', 'groups')
);
const hidden = { analyses: [], entities: [] };

function reviewed() {
    const record = structuredClone(original) as Json;
    const groups = record.groups as Json[];
    groups[0].n = ev(24, [at('scanned')]);
    groups[2].name = ev('Siblings');
    return createReviewStores(
        makeBundle(record, TEXT, {
            entities,
            original: { record: { local_id: 'P1', ...original }, entities, hidden },
        })
    );
}

const changed = (store: ReturnType<typeof reviewed>) =>
    selectDiff(store.session.getState())
        .shown.filter((item) => item.status !== 'same')
        .map((item) => item.key);

describe('the session’s diff against the original', () => {
    it('lines the review’s record up with the original, its spans in UTF-16 as the text has them', () => {
        const store = reviewed();
        expect(changed(store)).toEqual(['entity:grp_a', 'slot:grp_a:n', 'entity:grp_c', 'slot:grp_c:name']);
        expect(selectDiff(store.session.getState()).byKey.get('slot:grp_a:n')?.evidence).toEqual({
            before: [utf16('twenty')],
            after: [utf16('scanned')],
        });
    });

    it('has an item for each entity and each slot the review or the original holds', () => {
        const store = reviewed();
        const { items } = selectDiff(store.session.getState());
        expect(items.length).toBeGreaterThan(store.session.getState().index.entities.length);
        expect(items.map((item) => item.key)).toEqual(
            expect.arrayContaining(['entity:grp_a', 'slot:grp_a:name', 'slot:grp_a:n', 'entity:grp_c'])
        );
    });

    it('turns the diff on and off', () => {
        const store = reviewed();
        expect(store.view.getState().diffOn).toBe(false);
        store.view.getState().toggleDiff();
        expect(store.view.getState().diffOn).toBe(true);
        store.view.getState().toggleDiff(false);
        expect(store.view.getState().diffOn).toBe(false);
    });

    it('steps between the changed items, forward and back', () => {
        const store = reviewed();
        store.view.getState().toggleDiff(true);
        const keys = () => store.view.getState().focus.key;
        store.view.getState().moveChange(1);
        expect(keys()).toBe('entity:grp_a');
        store.view.getState().moveChange(1);
        expect(keys()).toBe('slot:grp_a:n');
        store.view.getState().moveChange(1);
        expect(keys()).toBe('entity:grp_c');
        store.view.getState().moveChange(-1);
        expect(keys()).toBe('slot:grp_a:n');
    });

    it('gives the focused item’s original spans while the diff is on, and none while it is off', () => {
        const store = reviewed();
        store.view.getState().focusSlot('slot:grp_a:n');
        expect(selectOriginalSpans(store.session.getState(), store.view.getState())).toEqual([]);
        store.view.getState().toggleDiff(true);
        expect(selectOriginalSpans(store.session.getState(), store.view.getState())).toEqual([utf16('twenty')]);
    });

    it('focuses an item by its target: a slot, an entity, a link or a coordinate analysis', () => {
        const store = reviewed();
        store.view.getState().focusTarget({ kind: 'slot', entity: 'grp_b', path: 'name' });
        expect(store.view.getState().focus.key).toBe('slot:grp_b:name');
        store.view.getState().focusTarget({ kind: 'entity', entity: 'grp_c' });
        expect(store.view.getState().focus.key).toBe('entity:grp_c');

        const coordinates = createReviewStores(coordinateBundle());
        coordinates.view.getState().focusTarget({ kind: 'coordinate_analysis', analysis_key: HOUSES.key });
        expect(coordinates.view.getState().coordinates?.analysis).toBe(HOUSES.key);
        coordinates.view.getState().focusTarget({
            kind: 'relationship',
            entity: 'ana_faces',
            path: 'mirror_of',
            target_entity: 'ana_houses',
        });
        expect(coordinates.view.getState().focus.key).toBe('relationship:ana_faces:mirror_of:ana_houses');
        expect(coordinates.view.getState().coordinates).toBeNull();
    });

    it('steps onto a changed coordinate analysis by its key in the revision', () => {
        const split = [
            { ...FACES, key: key(0xe1), points: FACES.points!.slice(0, 1), derived_from: [FACES.key] },
            { ...FACES, key: key(0xe2), points: FACES.points!.slice(1), derived_from: [FACES.key] },
        ];
        const analyses = [...split, HOUSES];
        const store = createReviewStores(
            coordinateBundle({
                coordinate_revision: {
                    ...revision(analyses),
                    verdicts: [{ key: FACES.key, verdict: 'split', replaced_by: split.map((a) => a.key) }],
                },
            })
        );
        store.view.getState().toggleDiff(true);
        store.view.getState().focusEntity('ana_faces');
        expect(store.view.getState().coordinates).toBeNull();
        store.view.getState().moveChange(1);
        expect(store.view.getState().coordinates?.analysis).toBe(split[0].key);
    });
});

const REMOVALS = {
    groups: [
        { local_id: 'grp_a', name: ev('Patients'), n: ev(20) },
        { local_id: 'grp_b', name: ev('Controls'), n: ev(18) },
        { local_id: 'grp_c', name: ev('Others') },
    ],
    analyses: [
        { local_id: 'a_1', name: ev('Patients > Controls'), groups: [{ group: 'grp_a', n: ev(20) }] },
        { local_id: 'a_hidden', name: ev('Other') },
    ],
};
const REMOVAL_ROWS = entityRows(
    row('grp_a', 'Group', 'groups'),
    row('grp_b', 'Group', 'groups'),
    row('grp_c', 'Group', 'groups'),
    row('a_1', 'Analysis', 'analyses'),
    row('a_hidden', 'Analysis', 'analyses')
);

/** grp_a's n edited, grp_b's n gone, a_1's link to grp_a moved to grp_b, grp_c gone, the hidden analysis renamed. */
function removals(showNonCoordinate = false) {
    const record = structuredClone(REMOVALS) as Json;
    const [a, b] = record.groups as Json[];
    a.n = ev(24);
    delete b.n;
    record.groups = (record.groups as Json[]).slice(0, 2);
    const [first, hiddenAnalysis] = record.analyses as Json[];
    (first.groups as Json[])[0].group = 'grp_b';
    hiddenAnalysis.name = ev('Another');
    const bundle = makeBundle(record, TEXT, {
        entities: REMOVAL_ROWS.filter((r) => r.local_id !== 'grp_c'),
        hidden: { analyses: ['a_hidden'], entities: [] },
        original: {
            record: { local_id: 'P1', ...REMOVALS },
            entities: REMOVAL_ROWS,
            hidden: { analyses: ['a_hidden'], entities: [] },
        },
    });
    const store = createReviewStores(bundle);
    if (showNonCoordinate) store.view.getState().toggleNonCoordinate();
    store.view.getState().toggleDiff(true);
    return store;
}

const LINK = 'relationship:a_1:groups[#0].group:grp_b';
const OLD_LINK = 'slot:a_1:groups[#0].group';

function walk(store: ReturnType<typeof removals>, delta: 1 | -1, steps: number) {
    const visited: string[] = [];
    for (let i = 0; i < steps; i++) {
        store.view.getState().moveChange(delta);
        visited.push(store.view.getState().focus.key);
    }
    return visited;
}

describe('stepping between changes across items the review lost', () => {
    it('lists the changes the walk has to cross: a removed slot, a removed link and a removed entity', () => {
        const store = removals();
        const items = selectDiff(store.session.getState()).shown;
        expect(items.filter((i) => i.status === 'removed').map((i) => i.key)).toEqual([
            'slot:grp_b:n',
            'relationship:a_1:groups[#0].group:grp_a',
            'entity:grp_c',
        ]);
    });

    it('goes forward over the removed slot to its entity, the removed link to its slot, and stops past the removed entity', () => {
        const store = removals();
        expect(walk(store, 1, 8)).toEqual([
            'entity:grp_a',
            'slot:grp_a:n',
            'entity:grp_b',
            'entity:a_1',
            LINK,
            OLD_LINK,
            OLD_LINK,
            OLD_LINK,
        ]);
    });

    it('goes back the same way, and on from the first change goes nowhere', () => {
        const store = removals();
        store.view.getState().focusSlot('slot:a_1:groups[#0].group');
        expect(walk(store, -1, 7)).toEqual([
            LINK,
            'entity:a_1',
            'entity:grp_b',
            'slot:grp_a:n',
            'entity:grp_a',
            'entity:grp_a',
            'entity:grp_a',
        ]);
    });

    it('goes back from an item that is no change to the last change that can be focused', () => {
        const store = removals();
        store.view.getState().focusSlot('slot:grp_a:name');
        expect(store.view.getState().focus.key).toBe('slot:grp_a:name');
        store.view.getState().moveChange(-1);
        expect(store.view.getState().focus.key).toBe(OLD_LINK);
    });

    it('goes forward from an item that is no change to the first change', () => {
        const store = removals();
        store.view.getState().focusSlot('slot:grp_a:name');
        store.view.getState().moveChange(1);
        expect(store.view.getState().focus.key).toBe('entity:grp_a');
    });
});

describe('the changes of the hidden analyses (R24)', () => {
    it('are not visited while the non-coordinate items are hidden, and are once they are shown', () => {
        expect(walk(removals(false), 1, 8)).not.toContain('entity:a_hidden');
        const store = removals(true);
        const keys = walk(store, 1, 12);
        expect(keys).toContain('entity:a_hidden');
        expect(keys).toContain('slot:a_hidden:name');
    });

    it('are not among the diff’s shown items, the entity and its slots alike', () => {
        const diff = selectDiff(removals(false).session.getState());
        const hidden = diff.items.filter((i) => i.hidden).map((i) => i.key);
        expect(hidden).toEqual(['entity:a_hidden', 'slot:a_hidden:name']);
        expect(diff.shown.map((i) => i.key)).not.toContain('entity:a_hidden');
    });
});

describe('focusing a target the review lost', () => {
    it('refuses a removed link, a removed entity, a missing slot and an analysis that is gone, and moves nothing', () => {
        const store = removals();
        const before = store.view.getState().focus;
        const focus = store.view.getState().focusTarget;
        expect(focus({ kind: 'relationship', entity: 'a_1', path: 'groups[#0].group', target_entity: 'grp_a' })).toBe(
            false
        );
        expect(focus({ kind: 'entity', entity: 'grp_c' })).toBe(false);
        expect(focus({ kind: 'slot', entity: 'grp_b', path: 'n' })).toBe(false);
        expect(focus({ kind: 'coordinate_analysis', analysis_key: key(0x99) })).toBe(false);
        expect(focus({ kind: 'paper' })).toBe(false);
        expect(store.view.getState().focus).toBe(before);
    });

    it('accepts the link the review holds', () => {
        const store = removals();
        expect(
            store.view
                .getState()
                .focusTarget({ kind: 'relationship', entity: 'a_1', path: 'groups[#0].group', target_entity: 'grp_b' })
        ).toBe(true);
        expect(store.view.getState().focus.key).toBe(LINK);
    });
});

describe('the original spans of a focused coordinate analysis', () => {
    it('are the spans of the original it replaced, while the diff is on', () => {
        const split = [
            { ...FACES, key: key(0xe1), points: FACES.points!.slice(0, 1), derived_from: [FACES.key] },
            { ...FACES, key: key(0xe2), points: FACES.points!.slice(1), derived_from: [FACES.key] },
        ];
        const faces = FACES.points!.map((p, i) => ({ ...p, text_span: { start_char: 10 * i, end_char: 10 * i + 4 } }));
        const parsed = { ...FACES, points: faces };
        const store = createReviewStores(
            coordinateBundle({
                coordinate_parse: { analyses: [parsed, HOUSES, LOCALIZER, SCRAMBLED] },
                coordinate_revision: {
                    ...revision([...split, HOUSES, LOCALIZER, SCRAMBLED]),
                    verdicts: [{ key: FACES.key, verdict: 'split', replaced_by: split.map((a) => a.key) }],
                },
            })
        );
        store.view.getState().focusAnalysis(split[1].key);
        expect(selectOriginalSpans(store.session.getState(), store.view.getState())).toEqual([]);
        store.view.getState().toggleDiff(true);
        expect(selectOriginalSpans(store.session.getState(), store.view.getState())).toEqual([
            [0, 4],
            [10, 14],
        ]);
    });
});

describe('stepping back from a coordinate analysis onto the record item that was focused before it', () => {
    it('focuses that item again, leaving the coordinates', () => {
        const edited = structuredClone(RECORD);
        edited.analyses[1].name = ev('Houses over faces');
        const [left, right] = [
            { ...FACES, key: key(0xe1), points: FACES.points!.slice(0, 1), derived_from: [FACES.key] },
            { ...FACES, key: key(0xe2), points: FACES.points!.slice(1), derived_from: [FACES.key] },
        ];
        const loaded = coordinateBundle();
        const store = createReviewStores(
            coordinateBundle({
                record: { local_id: 'P1', ...edited },
                original: loaded.original,
                coordinate_revision: {
                    ...revision([left, right, HOUSES, LOCALIZER, SCRAMBLED]),
                    verdicts: [{ key: FACES.key, verdict: 'split', replaced_by: [left.key, right.key] }],
                },
            })
        );
        store.view.getState().toggleDiff(true);
        store.view.getState().focusSlot('slot:ana_houses:name');
        store.view.getState().focusAnalysis(left.key);
        expect(store.view.getState().coordinates?.analysis).toBe(left.key);
        store.view.getState().moveChange(-1);
        expect(store.view.getState().coordinates).toBeNull();
        expect(store.view.getState().focus.key).toBe('slot:ana_houses:name');
    });
});

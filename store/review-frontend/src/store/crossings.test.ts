import type { OpResult } from '../api/reviewApi';
import { addAnalysis } from '../coordinates/actions';
import type { Op, Span } from '../contract/generated/review-ops';
import { addSelection } from '../text/addSelection';
import { entityRows, ev, makeBundle, notReported, row } from '../test/bundles';
import {
    coordinateBundle,
    coordinateResult,
    ENTITIES,
    FACES,
    HOUSES,
    key,
    LOCALIZER,
    PARSE,
    RECORD,
} from '../test/coordinates';
import { evidenceCursor, focusedSpans, shownIndex } from '../test/stores';
import { createReviewStores } from './reviewStores';
import { createSessionStore } from './sessionStore';
import { createViewStore } from './viewStore';

const TEXT = 'x'.repeat(300);

const record = {
    description: ev('A study', [[0, 10]]),
    groups: [
        {
            local_id: 'grp_a',
            name: ev('Patients', [[50, 58]]),
            description: ev('desc', [
                [5, 9],
                [90, 95],
            ]),
            species: notReported(),
            sex: ev('mixed'),
            arms: [
                { local_id: 'arm_1', name: ev('Arm', [[100, 103]]), parts: [{ local_id: 'part_1', name: ev('Part') }] },
            ],
        },
        { local_id: 'grp_b', name: ev('Controls', [[60, 68]]) },
    ],
};

const review = {
    id: 'r1',
    user_id: 'u1',
    state: 'in_progress',
    last_seq: 0,
    provenance: {},
    annotations: {},
} as const;

const open = () =>
    createReviewStores(
        makeBundle(record, TEXT, {
            entities: entityRows(
                row('grp_a', 'Group', 'groups'),
                row('grp_b', 'Group', 'groups'),
                row('arm_1', 'Arm', 'arms', { parent: 'grp_a' }),
                row('part_1', 'Part', 'parts', { parent: 'arm_1' })
            ),
            coordinate_parse: PARSE as never,
            review: { ...review },
        }),
        { now: () => 'now' }
    );

type Stores = ReturnType<typeof open>;

const evidenceOn = (path: string, spans: [number, number][]): Op => ({
    client_op_id: `ev-${path}`,
    type: 'set_evidence',
    target: { kind: 'slot', entity: 'grp_a', path },
    evidence: {
        status: 'present',
        sets: [{ spans: spans.map(([start_char, end_char]) => ({ start_char, end_char })) as [Span, ...Span[]] }],
    },
});

/** The server's answer to `sent`, holding the documents as the session shows them. */
function answer(store: Stores, sent: Op[], change: Partial<OpResult> = {}): OpResult {
    const { record: current, bundle, provenance, annotations } = store.session.getState();
    return {
        ops: sent.map((op, i) => ({ seq: i + 1, op, before: {}, after: {}, user_id: 'u1', created_at: 'now' })),
        last_seq: sent.length,
        record: current,
        coordinate_revision: bundle.coordinate_revision,
        provenance,
        annotations,
        hidden: bundle.hidden,
        entities: bundle.entities,
        ...change,
    };
}

/** A rebase onto the record without the arm and the part nested in it. */
function rebaseWithoutArm(store: Stores) {
    const { bundle } = store.session.getState();
    const current = bundle.record as typeof record;
    const [first, ...rest] = current.groups;
    store.session.getState().rebase({
        ...bundle,
        record: { ...current, groups: [{ ...first, arms: [] }, ...rest] },
        entities: bundle.entities.filter((e) => e.local_id !== 'arm_1' && e.local_id !== 'part_1'),
    });
}

const slotOrder = (store: Stores) =>
    shownIndex(store)
        .entity('grp_a')!
        .slots.filter((slot) => slot.value !== undefined)
        .map((slot) => slot.path);

describe('the view on a session', () => {
    it('leaves the session as it was when it is made', () => {
        const session = createSessionStore(makeBundle(record, TEXT));
        const before = session.getState();
        createViewStore(session);
        expect(session.getState()).toBe(before);
    });
});

describe('an edit that also moves the view: adding the selection to the evidence', () => {
    it('adds the span to the focused slot, then puts the evidence cursor on it', () => {
        const store = open();
        store.view.getState().focusSlot('slot:grp_a:description');
        store.view.getState().setSelection([20, 25]);
        addSelection(store, 'first');
        expect(focusedSpans(store)).toEqual([
            [5, 9],
            [20, 25],
            [90, 95],
        ]);
        expect(evidenceCursor(store)).toBe(1);
        expect(store.view.getState().selection).toBeNull();
    });
});

describe('what the view derives from the session’s documents', () => {
    it('highlights the spans of an edit the session applies, and none once it drops the pending edits', () => {
        const store = open();
        store.view.getState().focusSlot('slot:grp_a:sex');
        expect(focusedSpans(store)).toEqual([]);
        store.session.getState().emit(evidenceOn('sex', [[30, 35]]));
        expect(focusedSpans(store)).toEqual([[30, 35]]);
        store.session.getState().discardPending();
        expect(focusedSpans(store)).toEqual([]);
        expect(evidenceCursor(store)).toBe(0);
    });

    it('keeps the evidence cursor within the focused spans when an edit leaves fewer', () => {
        const store = open();
        store.view.getState().focusSlot('slot:grp_a:description');
        store.view.getState().stepEvidence(1);
        expect(evidenceCursor(store)).toBe(1);
        store.session.getState().emit(evidenceOn('description', [[5, 9]]));
        expect(evidenceCursor(store)).toBe(0);
        store.view.getState().stepEvidence(1);
        expect(evidenceCursor(store)).toBe(0);
    });

    it('leaves out the entities a server answer hides, once the index is rebuilt', () => {
        const store = open();
        store.view.getState().focusSlot('slot:grp_a:sex');
        store.session.getState().emit(evidenceOn('sex', [[30, 35]]));
        const sent = store.session.getState().pending;
        expect(shownIndex(store).visible.map((e) => e.id)).toContain('grp_b');
        store.session.getState().confirm(answer(store, sent, { hidden: { analyses: [], entities: ['grp_b'] } }), sent);
        expect(shownIndex(store).visible.map((e) => e.id)).not.toContain('grp_b');
        expect(shownIndex(store).entity('grp_b')?.hidden).toBe(true);
    });

    it('keeps the focused entity’s slot order through a rebuilt index, and sorts it once the focus moves', () => {
        const store = open();
        store.view.getState().focusSlot('slot:grp_a:sex');
        store.session.getState().emit(evidenceOn('sex', [[30, 35]]));
        expect(slotOrder(store)).toEqual(['sex', 'species', 'name', 'description']);
        const sent = store.session.getState().pending;
        store.session.getState().confirm(answer(store, sent, { hidden: { analyses: [], entities: ['grp_b'] } }), sent);
        expect(slotOrder(store)).toEqual(['sex', 'species', 'name', 'description']);
        store.view.getState().focusEntity('study');
        expect(slotOrder(store)).toEqual(['species', 'name', 'description', 'sex']);
    });
});

describe('the one crossing back: the view follows what a confirm or rebase replaced', () => {
    it('moves the focus off an entity a rebase finds gone to its nearest ancestor there is', () => {
        const store = open();
        store.view.getState().focusSlot('slot:part_1:name');
        rebaseWithoutArm(store);
        expect(store.view.getState().focus).toEqual({ entity: 'grp_a', key: 'entity:grp_a' });
    });

    it('moves the focus behind a coordinate focus to that ancestor, keeping the coordinate focus', () => {
        const store = open();
        store.view.getState().focusEntity('part_1');
        store.view.getState().focusAnalysis(FACES.key);
        rebaseWithoutArm(store);
        expect(store.view.getState().focus).toEqual({ entity: 'grp_a', key: 'entity:grp_a' });
        expect(store.view.getState().coordinates).toEqual({ analysis: FACES.key, point: null, selected: [] });
    });

    it('focuses the entity a create_entity made once the server confirms it', () => {
        const store = open();
        const created: Op = {
            client_op_id: 'c-1',
            type: 'create_entity',
            parent: 'study',
            list: 'groups',
            entity: { local_id: 'grp_c', name: ev('Siblings') },
        };
        store.session.getState().emit(created);
        const current = store.session.getState().record as typeof record;
        const groups = [...current.groups, { local_id: 'grp_c', name: ev('Siblings') }];
        const { entities } = store.session.getState().bundle;
        store.session.getState().confirm(
            answer(store, [created], {
                record: { ...current, groups },
                entities: [...entities, row('grp_c', 'Group', 'groups')],
            }),
            [created]
        );
        expect(store.view.getState().focus).toEqual({ entity: 'grp_c', key: 'entity:grp_c' });
    });

    it('offers the record entity an added analysis made, and keeps only the analyses still there for a merge', async () => {
        const store = createReviewStores(coordinateBundle(), { now: () => 'now' });
        store.view.getState().toggleMerge(HOUSES.key);
        expect(addAnalysis(store, 't1', { name: 'Faces > Objects', role: 'result' }, { coordinates: [1, 1, 1] })).toBe(
            true
        );
        const sent = store.session.getState().pending;
        const added = {
            ...FACES,
            key: key(0x5a5),
            name: 'Faces > Objects',
            points: [{ coordinates: [1, 1, 1] as [number, number, number] }],
        };
        const made = { local_id: 'rv_0123456789ab', name: ev('Faces > Objects'), source_table_analysis: ev(added.key) };
        store.session.getState().confirm(
            coordinateResult(sent, [FACES, LOCALIZER, added], {
                record: { analyses: [...RECORD.analyses, made] },
                entities: [...ENTITIES, row(made.local_id, 'Analysis', 'analyses')],
            }),
            sent
        );
        expect(store.view.getState().offer).toEqual({ entity: made.local_id });
        expect(store.view.getState().coordinates?.analysis).toBe(added.key);
        expect(store.view.getState().merging).toEqual([]);
    });
});

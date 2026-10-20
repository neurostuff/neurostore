import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { createReviewStores } from './reviewStores';
import { openPanelOn } from '../inspector/openPanel';
import { evidenceCursor, focusedSpans, shownIndex } from '../test/stores';
import { GROUP_REFERENCE, TEXT, record, referencingBundle, setup } from '../test/storeFixture';
import { selectFocusedSpans } from './viewSelectors';

describe('navigating the view', () => {
    it('starts on the first entity, focused by its target key', () => {
        const store = setup();
        expect(store.view.getState().focus).toEqual({ entity: 'study', key: 'entity:study' });
    });

    it('steps through the focused entity’s slots in the order its card shows them and stops at the ends', () => {
        const store = setup();
        store.view.getState().focusEntity('grp_a');
        const keys = store.session
            .getState()
            .index.entity('grp_a')!
            .slots.map((s) => s.key);
        // The LinkML's order for Group: name, description, species, then sex.
        expect(keys.filter((key) => /:(sex|species|name|description)$/.test(key))).toEqual([
            'slot:grp_a:name',
            'slot:grp_a:description',
            'slot:grp_a:species',
            'slot:grp_a:sex',
        ]);
        // The card: its title (name), its sentence (species), its pairs (sex), its rows (description), its links.
        const shown = ['name', 'species', 'sex', 'description', 'arm', 'diagnostic_instrument'].map(
            (path) => `slot:grp_a:${path}`
        );
        const seen = shown.map(() => {
            store.view.getState().moveSlot(1);
            return store.view.getState().focus.key;
        });
        expect(seen).toEqual(shown);
        store.view.getState().moveSlot(1);
        expect(store.view.getState().focus.key).toBe(shown.at(-1));
        store.view.getState().moveSlot(-1);
        expect(store.view.getState().focus.key).toBe(shown.at(-2));
        store.view.getState().focusSlot(shown[1]);
        store.view.getState().moveSlot(-1);
        expect(store.view.getState().focus.key).toBe(shown[0]);
        store.view.getState().moveSlot(-1);
        expect(store.view.getState().focus.key).toBe(shown[0]);
    });

    it('steps through visible entities, skipping hidden ones', () => {
        const store = setup();
        const seen = [1, 1, 1, 1].map(() => {
            store.view.getState().moveEntity(1);
            return store.view.getState().focus.entity;
        });
        expect(seen).toEqual(['grp_a', 'grp_b', 'grp_b', 'grp_b']);
        store.view.getState().moveEntity(-1);
        expect(store.view.getState().focus).toEqual({ entity: 'grp_a', key: 'entity:grp_a' });
    });

    it('steps through the focused item’s evidence and wraps', () => {
        const store = setup();
        store.view.getState().focusSlot('slot:grp_a:description');
        expect(focusedSpans(store)).toEqual([
            [5, 9],
            [90, 95],
        ]);
        expect(evidenceCursor(store)).toBe(0);
        store.view.getState().stepEvidence(1);
        expect(evidenceCursor(store)).toBe(1);
        store.view.getState().stepEvidence(1);
        expect(evidenceCursor(store)).toBe(0);
        store.view.getState().stepEvidence(-1);
        expect(evidenceCursor(store)).toBe(1);
    });

    it('focuses an entity’s evidence as the union of its slots’ spans', () => {
        const store = setup();
        store.view.getState().focusEntity('grp_a');
        expect(focusedSpans(store)).toEqual([
            [5, 9],
            [50, 58],
            [90, 95],
        ]);
    });

    it('asks the text to reveal the first span on focus and the span stepped to, each time with a new seq', () => {
        const store = setup();
        store.view.getState().focusSlot('slot:grp_a:description');
        const first = store.view.getState().reveal;
        expect(first?.span).toEqual([5, 9]);
        store.view.getState().stepEvidence(1);
        expect(store.view.getState().reveal).toEqual({ span: [90, 95], seq: first!.seq + 1 });
        store.view.getState().focusSlot('slot:grp_a:description');
        expect(store.view.getState().reveal).toEqual({ span: [5, 9], seq: first!.seq + 2 });
        expect(evidenceCursor(store)).toBe(0);
        store.view.getState().focusSlot('slot:grp_a:sex');
        expect(store.view.getState().reveal?.seq).toBe(first!.seq + 2);
    });
});

describe('inspector panels and links', () => {
    it('opens a panel on the focused item and closes it when the focus moves', () => {
        const store = setup();
        store.view.getState().focusSlot('slot:grp_a:name');
        openPanelOn(store, 'reject');
        expect(store.view.getState().panel).toEqual({
            kind: 'reject',
            target: { kind: 'slot', entity: 'grp_a', path: 'name' },
            slot: 'slot:grp_a:name',
        });
        store.view.getState().closePanel();
        expect(store.view.getState().panel).toBeNull();
        openPanelOn(store, 'note');
        store.view.getState().focusSlot('slot:grp_a:sex');
        expect(store.view.getState().panel).toBeNull();
    });

    it('opens only the panels that apply to the focus', () => {
        const store = setup();
        store.view.getState().focusEntity('grp_a');
        openPanelOn(store, 'edit');
        expect(store.view.getState().panel).toBeNull();
        openPanelOn(store, 'link');
        expect(store.view.getState().panel).toBeNull();
        openPanelOn(store, 'reject');
        expect(store.view.getState().panel).toEqual({ kind: 'reject', target: { kind: 'entity', entity: 'grp_a' } });
    });

    it('focuses a link by its relationship key, on its entity', () => {
        const store = createReviewStores(
            makeBundle({ ...record, analyses: [{ local_id: 'a_1', groups: [{ group: 'grp_a' }] }] }, TEXT, {
                entities: entityRows(row('grp_a', 'Group', 'groups'), row('a_1', 'Analysis', 'analyses')),
            })
        );
        store.view.getState().focusLink(GROUP_REFERENCE, 'grp_a');
        expect(store.view.getState().focus).toEqual({
            entity: 'a_1',
            key: 'relationship:a_1:groups[#0].group:grp_a',
            slot: GROUP_REFERENCE,
        });
    });
});

describe('non-coordinate analyses in the view', () => {
    it('lists them in index.visible while the toggle is on, and hides them again', () => {
        const store = setup();
        const visible = () => shownIndex(store).visible.map((e) => e.id);
        expect(visible()).not.toContain('a_hidden');
        store.view.getState().toggleNonCoordinate();
        expect(visible()).toContain('a_hidden');
        store.view.getState().toggleNonCoordinate();
        expect(visible()).not.toContain('a_hidden');
    });
});

describe('focusing a reference field', () => {
    const referencing = (analysis: Record<string, unknown>, hidden: string[] = []) =>
        createReviewStores(
            referencingBundle(
                {
                    ...record,
                    acquisitions: [
                        { local_id: 'acq_1', name: ev('Scan', [[100, 104]]) },
                        { local_id: 'acq_2', name: ev('Rest', [[20, 24]]), description: ev('d', [[100, 104]]) },
                    ],
                },
                TEXT,
                entityRows(
                    row('grp_a', 'Group', 'groups'),
                    row('grp_b', 'Group', 'groups'),
                    row('acq_1', 'Acquisition', 'acquisitions'),
                    row('acq_2', 'Acquisition', 'acquisitions')
                ),
                analysis,
                { hidden: { analyses: [], entities: hidden } }
            )
        );

    it('highlights every span of the entity it references', () => {
        const store = referencing({ groups: [{ group: 'grp_a' }] });
        store.view.getState().focusSlot(GROUP_REFERENCE);
        expect(focusedSpans(store)).toEqual([
            [5, 9],
            [50, 58],
            [90, 95],
        ]);
    });

    it('highlights the union of several references in reading order, each span once', () => {
        const store = referencing({ acquisitions: ['acq_1', 'acq_2'] });
        store.view.getState().focusSlot('slot:a_1:acquisitions');
        expect(focusedSpans(store)).toEqual([
            [20, 24],
            [100, 104],
        ]);
    });

    it('gives the same spans to two reads of the same index and focus', () => {
        const store = referencing({ groups: [{ group: 'grp_a' }] });
        store.view.getState().focusSlot(GROUP_REFERENCE);
        const session = store.session.getState();
        const view = store.view.getState();
        expect(selectFocusedSpans(session, view)).toBe(selectFocusedSpans(session, { ...view }));
    });

    it('takes nothing from a hidden entity', () => {
        const store = referencing({ acquisitions: ['acq_1', 'acq_2'] }, ['acq_2']);
        store.view.getState().focusSlot('slot:a_1:acquisitions');
        expect(focusedSpans(store)).toEqual([[100, 104]]);
    });

    it('takes nothing from a missing entity', () => {
        const store = referencing({ acquisitions: ['acq_1', 'acq_gone'] });
        store.view.getState().focusSlot('slot:a_1:acquisitions');
        expect(focusedSpans(store)).toEqual([[100, 104]]);
    });

    it('gives each reference field its own spans in one index', () => {
        const store = referencing({ groups: [{ group: 'grp_a' }], acquisitions: ['acq_1', 'acq_2'] });
        store.view.getState().focusSlot(GROUP_REFERENCE);
        expect(focusedSpans(store)).toEqual([
            [5, 9],
            [50, 58],
            [90, 95],
        ]);
        store.view.getState().focusSlot('slot:a_1:acquisitions');
        expect(focusedSpans(store)).toEqual([
            [20, 24],
            [100, 104],
        ]);
    });

    it('includes evidence added to the referenced entity since the field was last focused', () => {
        const store = referencing({ groups: [{ group: 'grp_a' }] });
        store.view.getState().focusSlot(GROUP_REFERENCE);
        store.view.getState().focusSlot('slot:grp_a:name');
        store.session.getState().addEvidence('slot:grp_a:name', [120, 130], 0);
        store.view.getState().focusSlot(GROUP_REFERENCE);
        expect(focusedSpans(store)).toEqual([
            [5, 9],
            [50, 58],
            [90, 95],
            [120, 130],
        ]);
    });

    it('asks the text to reveal the first referenced span on focus', () => {
        const store = referencing({ groups: [{ group: 'grp_a' }] });
        store.view.getState().focusSlot(GROUP_REFERENCE);
        expect(store.view.getState().reveal?.span).toEqual([5, 9]);
    });
});

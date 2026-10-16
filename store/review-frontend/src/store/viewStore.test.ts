import { entityRows, makeBundle, row } from '../test/bundles';
import { createReviewStores } from './context';
import { openPanelOn } from '../inspector/openPanel';
import { evidenceCursor, focusedSpans, shownIndex } from '../test/stores';
import { TEXT, record, setup } from '../test/storeFixture';

describe('navigating the view', () => {
    it('starts on the first entity, focused by its target key', () => {
        const store = setup();
        expect(store.view.getState().focus).toEqual({ entity: 'study', key: 'entity:study' });
    });

    it('steps through the focused entity’s slots in inspector order and stops at the ends', () => {
        const store = setup();
        store.view.getState().focusEntity('grp_a');
        const keys = store.session
            .getState()
            .index.entity('grp_a')!
            .slots.map((s) => s.key);
        expect(keys.slice(0, 4)).toEqual([
            'slot:grp_a:sex',
            'slot:grp_a:species',
            'slot:grp_a:name',
            'slot:grp_a:description',
        ]);
        const seen = keys.map(() => {
            store.view.getState().moveSlot(1);
            return store.view.getState().focus.key;
        });
        expect(seen).toEqual(keys);
        store.view.getState().moveSlot(1);
        expect(store.view.getState().focus.key).toBe(keys.at(-1));
        store.view.getState().moveSlot(-1);
        expect(store.view.getState().focus.key).toBe(keys.at(-2));
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
        store.view.getState().focusLink('slot:a_1:groups[#0].group', 'grp_a');
        expect(store.view.getState().focus).toEqual({
            entity: 'a_1',
            key: 'relationship:a_1:groups[#0].group:grp_a',
            slot: 'slot:a_1:groups[#0].group',
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

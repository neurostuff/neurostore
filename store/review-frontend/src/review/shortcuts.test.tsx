import { act, fireEvent, screen, within } from '@testing-library/react';
import type { ReviewBundle } from '../contract/generated/review-bundle';
import type { Op } from '../contract/generated/review-ops';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { coordinateBundle, CUNEUS, FACES, HOUSES, key, LOCALIZER, revision, SCRAMBLED } from '../test/coordinates';
import { renderWithStores } from '../test/render';
import { answerPending, withoutIds } from '../test/undoHelpers';
import { ReviewScreen } from './ReviewScreen';
import { focusedSpans } from '../test/stores';

// Handsontable does not lay out in jsdom; these tests drive the package's stand-in, which runs its hooks as it does.
vi.mock('@handsontable/react-wrapper', () => import('@neurosynth/coordinate-table/testing'));
vi.mock('handsontable/registry', () => ({ registerAllModules: () => {} }));

const TEXT = 'We scanned twenty patients and twenty controls on a 3 T scanner.';
const at = (word: string): [number, number] => [TEXT.indexOf(word), TEXT.indexOf(word) + word.length];

const record = {
    description: ev('fMRI study', [at('scanned')]),
    groups: [
        { local_id: 'grp_a', name: ev('Patients', [at('patients')]), n: ev(20, [at('twenty'), at('scanner')]) },
        { local_id: 'grp_b', name: ev('Controls', [at('controls')]) },
    ],
};

const entities = entityRows(row('grp_a', 'Group', 'groups'), row('grp_b', 'Group', 'groups'));
const setup = () => renderWithStores(<ReviewScreen />, makeBundle(record, TEXT, { entities }));
const press = (key: string, init: KeyboardEventInit = {}, target: Element = document.body) =>
    act(() => void fireEvent.keyDown(target, { key, ...init }));

describe('review shortcuts', () => {
    it('J and K move between slots, Shift+J and Shift+K between entities', () => {
        const { stores } = setup();
        press('J', { shiftKey: true });
        expect(stores.view.getState().focus).toEqual({ entity: 'grp_a', key: 'entity:grp_a' });
        const [first, second] = stores.session
            .getState()
            .index.entity('grp_a')!
            .slots.map((s) => s.key);
        press('j');
        press('j');
        expect(stores.view.getState().focus.key).toBe(second);
        press('k');
        expect(stores.view.getState().focus.key).toBe(first);
        press('J', { shiftKey: true });
        expect(stores.view.getState().focus.entity).toBe('grp_b');
        press('K', { shiftKey: true });
        expect(stores.view.getState().focus).toEqual({ entity: 'grp_a', key: 'entity:grp_a' });
    });

    it('] and [ step through the evidence and wrap', () => {
        const { stores } = setup();
        act(() => stores.view.getState().focusSlot('slot:grp_a:n'));
        press(']');
        expect(screen.getByText('evidence 2 of 2')).toBeInTheDocument();
        press(']');
        expect(screen.getByText('evidence 1 of 2')).toBeInTheDocument();
        press('[');
        expect(screen.getByText('evidence 2 of 2')).toBeInTheDocument();
    });

    it('D shows the diff, where J and K step between the changed items; Esc or D leaves it', () => {
        const edited = structuredClone(record);
        edited.groups[1].name = ev('Healthy controls', [at('controls')]);
        edited.description = ev('An fMRI study', [at('scanned')]);
        const { stores } = renderWithStores(
            <ReviewScreen />,
            makeBundle(edited, TEXT, {
                entities,
                original: {
                    record: { local_id: 'P1', ...record },
                    coordinate_revision: null,
                    entities,
                    hidden: { analyses: [], entities: [] },
                },
            })
        );
        expect(stores.view.getState().focus.key).toBe('entity:study');
        press('d');
        expect(stores.view.getState().diffOn).toBe(true);
        press('j');
        expect(stores.view.getState().focus.key).toBe('slot:study:description');
        press('j');
        expect(stores.view.getState().focus.key).toBe('entity:grp_b');
        press('j');
        expect(stores.view.getState().focus.key).toBe('slot:grp_b:name');
        press('k');
        expect(stores.view.getState().focus.key).toBe('entity:grp_b');
        press('Escape');
        expect(stores.view.getState().diffOn).toBe(false);
        press('j');
        expect(stores.view.getState().focus.key).toBe(stores.session.getState().index.entity('grp_b')!.slots[0].key);
        press('D');
        expect(stores.view.getState().diffOn).toBe(true);
        press('d');
        expect(stores.view.getState().diffOn).toBe(false);
    });

    it('J and K step between the changed analyses in the coordinates scope while the diff is on, and between points otherwise', () => {
        const left = { ...FACES, key: key(0xe1), points: FACES.points!.slice(0, 1), derived_from: [FACES.key] };
        const right = { ...FACES, key: key(0xe2), points: FACES.points!.slice(1), derived_from: [FACES.key] };
        const resized = { ...HOUSES, points: [{ ...CUNEUS, cluster_size: 40 }] };
        const verdict = (a: { key: string }, kind: string, replaced_by?: string[]) => ({
            key: a.key,
            verdict: kind,
            reason: 'x',
            ...(replaced_by && { replaced_by }),
        });
        const { stores } = renderWithStores(
            <ReviewScreen />,
            coordinateBundle({
                coordinate_revision: {
                    ...revision([left, right, resized, LOCALIZER, SCRAMBLED]),
                    verdicts: [
                        verdict(FACES, 'split', [left.key, right.key]),
                        verdict(HOUSES, 'edit'),
                        verdict(LOCALIZER, 'accept'),
                        verdict(SCRAMBLED, 'accept'),
                    ],
                },
            })
        );
        act(() => stores.view.getState().focusAnalysis(left.key));
        press('j');
        expect(stores.view.getState().coordinates).toMatchObject({ analysis: left.key, point: 0 });
        act(() => stores.view.getState().toggleDiff(true));
        press('j');
        expect(stores.view.getState().coordinates?.analysis).toBe(HOUSES.key);
        press('k');
        expect(stores.view.getState().coordinates?.analysis).toBe(left.key);
    });

    it('O toggles the outline, which lists entities by class and closes on picking one', () => {
        const { stores } = setup();
        const outline = () => screen.queryByRole('navigation', { name: 'outline' });
        expect(outline()).not.toBeInTheDocument();
        press('o');
        expect(outline()).toHaveTextContent('Group');
        press('O', { shiftKey: true });
        expect(outline()).not.toBeInTheDocument();
        press('o');
        fireEvent.click(screen.getByRole('button', { name: /^Controls/ }));
        expect(stores.view.getState().focus.entity).toBe('grp_b');
        expect(outline()).not.toBeInTheDocument();
    });

    it('Shift+V shows and hides all the evidence', () => {
        const { stores } = setup();
        press('V', { shiftKey: true });
        expect(stores.view.getState().showAllEvidence).toBe(true);
        press('V', { shiftKey: true });
        expect(stores.view.getState().showAllEvidence).toBe(false);
    });

    it('a letter typed with Caps Lock runs its Shift shortcut', () => {
        const { stores } = setup();
        act(() => stores.view.getState().focusSlot('slot:grp_a:name'));
        press('J');
        expect(stores.view.getState().focus.entity).toBe('grp_b');
    });

    it('? opens the shortcut help', () => {
        setup();
        press('?', { shiftKey: true });
        expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toHaveTextContent('next slot');
    });

    it('lists j and Shift+J as different keys in the help', () => {
        setup();
        press('?', { shiftKey: true });
        const keys = within(screen.getByRole('dialog', { name: 'Keyboard shortcuts' }))
            .getAllByRole('row')
            .map((row) => row.firstElementChild?.textContent);
        expect(keys).toEqual(expect.arrayContaining(['j', 'k', 'e', 'Shift+J', 'Shift+K']));
        expect(keys).not.toContain('J');
    });

    it('offers one way to add evidence in the help, and never speaks of evidence sets', () => {
        setup();
        press('?', { shiftKey: true });
        const help = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
        expect(help).not.toHaveTextContent(/evidence set/i);
        expect(within(help).queryByText('Shift+E')).not.toBeInTheDocument();
    });

    it('lists the editing keys in the help', () => {
        setup();
        press('?', { shiftKey: true });
        const keys = within(screen.getByRole('dialog', { name: 'Keyboard shortcuts' }))
            .getAllByRole('row')
            .map((row) => row.firstElementChild?.textContent);
        expect(keys).toEqual(
            expect.arrayContaining(['a', 'Shift+A', 'r', 'Enter', 'n', 'l', 'c', 'Shift+Backspace', ';'])
        );
    });

    it.each([
        ['A', { key: 'a' }],
        ['Enter', { key: 'Enter' }],
        ['R', { key: 'r' }],
        ['Shift+Backspace', { key: 'Backspace', shiftKey: true }],
        [';', { key: ';' }],
    ])('ignores %s typed into a text field', (_, init) => {
        const { stores } = setup();
        act(() => stores.view.getState().focusSlot('slot:grp_a:name'));
        const field = document.body.appendChild(document.createElement('input'));
        press(init.key, init, field);
        expect(stores.session.getState().pending).toEqual([]);
        expect(stores.view.getState().panel).toBeNull();
        field.remove();
    });

    it('leaves Enter on a button to the button', () => {
        const { stores } = setup();
        act(() => stores.view.getState().focusSlot('slot:grp_a:name'));
        const button = document.body.appendChild(document.createElement('button'));
        press('Enter', {}, button);
        expect(stores.view.getState().panel).toBeNull();
        button.remove();
    });

    it('leaves Enter in the text pane to the text, which focuses the evidence under the cursor', () => {
        const { stores, container } = setup();
        act(() => stores.view.getState().focusSlot('slot:grp_a:name'));
        const scroller = container.querySelector<HTMLElement>('[data-text-scroller]')!;
        press('Enter', {}, scroller);
        expect(stores.view.getState().panel).toBeNull();
    });

    it('leaves Enter in the text pane to the text when no evidence is focused', () => {
        const { stores, container } = setup();
        const unread = stores.session
            .getState()
            .index.entity('study')!
            .slots.find((s) => s.spans.length === 0)!;
        act(() => stores.view.getState().focusSlot(unread.key));
        expect(focusedSpans(stores)).toEqual([]);
        const scroller = container.querySelector<HTMLElement>('[data-text-scroller]')!;
        press('Enter', {}, scroller);
        expect(stores.view.getState().panel).toBeNull();
    });

    it('runs no shortcut while an inspector panel is open', () => {
        const { stores } = setup();
        act(() => stores.view.getState().focusSlot('slot:grp_a:name'));
        press('r');
        press('a', {}, screen.getByRole('group', { name: 'reject Name' }));
        press('J', { shiftKey: true }, document.body);
        expect(stores.session.getState().pending).toEqual([]);
        expect(stores.view.getState().focus.key).toBe('slot:grp_a:name');
    });

    it.each([
        ['an input', () => document.createElement('input')],
        ['a textarea', () => document.createElement('textarea')],
        ['a select', () => document.createElement('select')],
        [
            'a contenteditable element',
            () => {
                const div = document.createElement('div');
                div.setAttribute('contenteditable', '');
                return div;
            },
        ],
    ])('ignores single keys typed into %s', (_, make) => {
        const { stores } = setup();
        const field = document.body.appendChild(make());
        press('J', { shiftKey: true }, field);
        press('o', {}, field);
        expect(stores.view.getState().focus.entity).toBe('study');
        expect(stores.view.getState().outlineOpen).toBe(false);
        field.remove();
    });

    it.each(['ctrlKey', 'metaKey', 'altKey'])('leaves a key pressed with %s to the browser', (modifier) => {
        const { stores } = setup();
        press('o', { [modifier]: true });
        press('J', { shiftKey: true, [modifier]: true });
        expect(stores.view.getState().outlineOpen).toBe(false);
        expect(stores.view.getState().focus.entity).toBe('study');
    });

    it('runs no shortcut while the help is open', () => {
        const { stores } = setup();
        press('?', { shiftKey: true });
        press('J', { shiftKey: true });
        press('o');
        expect(stores.view.getState().focus.entity).toBe('study');
        expect(stores.view.getState().outlineOpen).toBe(false);
    });
});

describe('undo and redo keys', () => {
    const review: NonNullable<ReviewBundle['review']> = {
        id: 'r1',
        user_id: 'u1',
        state: 'in_progress',
        last_seq: 0,
        provenance: {},
        annotations: {},
    };
    const rename = (client_op_id: string, value: string): Op => ({
        client_op_id,
        type: 'set_value',
        target: { kind: 'slot', entity: 'grp_a', path: 'name' },
        value: { extraction_status: 'extracted', value, value_source: 'reported' },
    });
    const nameOf = (stores: ReturnType<typeof setup>['stores']) =>
        (stores.session.getState().record.groups as { name: { value: string } }[])[0].name.value;
    const answer = (stores: ReturnType<typeof setup>['stores'], value: string) =>
        act(() => void answerPending(stores, () => withoutIds([rename('inverse-0001', value)])));

    function edited() {
        const rendered = renderWithStores(<ReviewScreen />, makeBundle(record, TEXT, { entities, review }));
        act(() => void rendered.stores.session.getState().emit(rename('edit-0001', 'Cases')));
        answer(rendered.stores, 'Patients');
        return rendered;
    }

    it.each(['ctrlKey', 'metaKey'])('Z with %s undoes the last edit, and with Shift too redoes it', (modifier) => {
        const { stores } = edited();
        press('z', { [modifier]: true });
        expect(nameOf(stores)).toBe('Patients');
        answer(stores, 'Cases');
        press('Z', { [modifier]: true, shiftKey: true });
        expect(nameOf(stores)).toBe('Cases');
    });

    it('shows the server’s reason for a refused undo', () => {
        const { stores } = edited();
        press('z', { ctrlKey: true });
        const [undo] = stores.session.getState().pending;
        act(() => stores.session.getState().refuse([{ op: undo, message: 'the name has changed since' }]));
        expect(screen.getByText(/could not be undone/)).toHaveTextContent(
            'Cases · Name: could not be undone (the name has changed since)'
        );
    });

    it('Ctrl+Y redoes', () => {
        const { stores } = edited();
        press('z', { ctrlKey: true });
        expect(nameOf(stores)).toBe('Patients');
        answer(stores, 'Cases');
        press('y', { ctrlKey: true });
        expect(nameOf(stores)).toBe('Cases');
    });

    it('leaves Ctrl+Z in a text field to the field’s own undo', () => {
        const { stores } = edited();
        const field = document.body.appendChild(document.createElement('input'));
        const notPrevented = fireEvent.keyDown(field, { key: 'z', ctrlKey: true });
        expect(notPrevented).toBe(true);
        expect(nameOf(stores)).toBe('Cases');
        field.remove();
    });

    it.each([
        ['a textarea', () => document.createElement('textarea')],
        [
            'a contenteditable element',
            () => {
                const div = document.createElement('div');
                div.setAttribute('contenteditable', '');
                return div;
            },
        ],
    ])('leaves Ctrl+Z in %s inside the review screen to the field’s own undo', (_, make) => {
        const { stores, container } = edited();
        const field = container.appendChild(make());
        expect(fireEvent.keyDown(field, { key: 'z', ctrlKey: true })).toBe(true);
        expect(nameOf(stores)).toBe('Cases');
        expect(stores.session.getState().pending).toEqual([]);
        field.remove();
    });

    it('shows the server’s reason for a refused redo', () => {
        const { stores } = edited();
        press('z', { ctrlKey: true });
        answer(stores, 'Cases');
        press('z', { ctrlKey: true, shiftKey: true });
        const [redo] = stores.session.getState().pending;
        act(() => stores.session.getState().refuse([{ op: redo, message: 'the name has changed since' }]));
        expect(screen.getByText(/could not be redone/)).toHaveTextContent(
            'Patients · Name: could not be redone (the name has changed since)'
        );
    });

    it('redo pressed while its step is unconfirmed waits, then sends once the server answers', () => {
        const { stores } = edited();
        press('z', { ctrlKey: true });
        press('z', { ctrlKey: true, shiftKey: true });
        expect(nameOf(stores)).toBe('Patients');
        expect(stores.session.getState().pending).toHaveLength(1);
        answer(stores, 'Cases');
        expect(nameOf(stores)).toBe('Cases');
    });

    it('leaves Ctrl with other keys to the browser', () => {
        edited();
        expect(fireEvent.keyDown(document.body, { key: 's', ctrlKey: true })).toBe(true);
        expect(fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true, altKey: true })).toBe(true);
    });

    it('lists undo and redo in the help', () => {
        setup();
        press('?', { shiftKey: true });
        const keys = within(screen.getByRole('dialog', { name: 'Keyboard shortcuts' }))
            .getAllByRole('row')
            .map((row) => row.firstElementChild?.textContent);
        expect(keys).toEqual(expect.arrayContaining(['Ctrl+Z', 'Ctrl+Shift+Z']));
    });

    it('names the Cmd key in one place in the help', () => {
        setup();
        press('?', { shiftKey: true });
        const help = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
        expect(help.textContent?.match(/Cmd/g)).toHaveLength(1);
    });
});

describe('evidence span keys', () => {
    const NAME = 'slot:grp_a:name';
    const SPAN_KEYS: [string, KeyboardEventInit][] = [
        [',', {}],
        ['.', {}],
        ['<', { shiftKey: true }],
        ['>', { shiftKey: true }],
        ['Backspace', {}],
    ];
    const spans = (stores: ReturnType<typeof setup>['stores']) => stores.session.getState().index.slot(NAME)?.spans;
    const focusName = () => {
        const view = setup();
        act(() => view.stores.view.getState().focusSlot(NAME));
        return view;
    };

    it('< and > move the start a word, comma and full stop the end, one edit a press', () => {
        const { stores } = focusName();
        press('<', { shiftKey: true });
        expect(spans(stores)).toEqual([[at('twenty')[0], at('patients')[1]]]);
        press('.');
        expect(spans(stores)).toEqual([[at('twenty')[0], at('and')[1]]]);
        press(',');
        expect(spans(stores)).toEqual([[at('twenty')[0], at('patients')[1]]]);
        press('>', { shiftKey: true });
        expect(spans(stores)).toEqual([at('patients')]);
        expect(stores.session.getState().undoStack).toHaveLength(4);
    });

    it('never moves one end past the other', () => {
        const { stores } = focusName();
        press('>', { shiftKey: true });
        press(',');
        expect(spans(stores)).toEqual([at('patients')]);
        expect(stores.session.getState().pending).toEqual([]);
    });

    it('Backspace removes the focused span, in one edit', () => {
        const { stores } = focusName();
        press('Backspace');
        expect(spans(stores)).toEqual([]);
        expect(stores.session.getState().undoStack).toHaveLength(1);
    });

    it('does nothing in a tab another one holds the review in', () => {
        const { stores } = focusName();
        act(() => stores.session.getState().setDevice('readonly'));
        press('Backspace');
        press('.');
        expect(spans(stores)).toEqual([at('patients')]);
    });

    it('does nothing while no span is focused', () => {
        const { stores } = setup();
        act(() => stores.view.getState().focusEntity('grp_a'));
        for (const [key, init] of SPAN_KEYS) press(key, init);
        expect(stores.session.getState().pending).toEqual([]);
        expect(stores.view.getState().focus).toEqual({ entity: 'grp_a', key: 'entity:grp_a' });
        expect(stores.view.getState().panel).toBeNull();
        expect(spans(stores)).toEqual([at('patients')]);
    });

    it.each([
        ['an input', 'input'],
        ['a textarea', 'textarea'],
    ])('ignores the span keys typed into %s', (_, tag) => {
        const { stores } = focusName();
        const field = document.body.appendChild(document.createElement(tag));
        for (const [key, init] of SPAN_KEYS) press(key, init, field);
        expect(stores.session.getState().pending).toEqual([]);
        expect(spans(stores)).toEqual([at('patients')]);
        field.remove();
    });

    it('lists the span keys in the help', () => {
        setup();
        press('?', { shiftKey: true });
        const keys = within(screen.getByRole('dialog', { name: 'Keyboard shortcuts' }))
            .getAllByRole('row')
            .map((row) => row.firstElementChild?.textContent);
        expect(keys).toEqual(expect.arrayContaining(SPAN_KEYS.map(([key]) => key)));
    });
});

import { act, fireEvent, screen, within } from '@testing-library/react';
import type { ReviewBundle } from '../contract/generated/review-bundle';
import type { Op } from '../contract/generated/review-ops';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { renderWithStore } from '../test/render';
import { answerPending, withoutIds } from '../test/undoHelpers';
import { ReviewScreen } from './ReviewScreen';

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
const setup = () => renderWithStore(<ReviewScreen />, makeBundle(record, TEXT, { entities }));
const press = (key: string, init: KeyboardEventInit = {}, target: Element = document.body) =>
    act(() => void fireEvent.keyDown(target, { key, ...init }));

describe('review shortcuts', () => {
    it('J and K move between slots, Shift+J and Shift+K between entities', () => {
        const { store } = setup();
        press('J', { shiftKey: true });
        expect(store.getState().focus).toEqual({ entity: 'grp_a', key: 'entity:grp_a' });
        press('j');
        press('j');
        expect(store.getState().focus.key).toBe('slot:grp_a:n');
        press('k');
        expect(store.getState().focus.key).toBe('slot:grp_a:name');
        press('J', { shiftKey: true });
        expect(store.getState().focus.entity).toBe('grp_b');
        press('K', { shiftKey: true });
        expect(store.getState().focus).toEqual({ entity: 'grp_a', key: 'entity:grp_a' });
    });

    it('] and [ step through the evidence and wrap', () => {
        const { store } = setup();
        act(() => store.getState().focusSlot('slot:grp_a:n'));
        press(']');
        expect(screen.getByText('evidence 2 of 2')).toBeInTheDocument();
        press(']');
        expect(screen.getByText('evidence 1 of 2')).toBeInTheDocument();
        press('[');
        expect(screen.getByText('evidence 2 of 2')).toBeInTheDocument();
    });

    it('O toggles the outline, which lists entities by class and closes on picking one', () => {
        const { store } = setup();
        const outline = () => screen.queryByRole('navigation', { name: 'outline' });
        expect(outline()).not.toBeInTheDocument();
        press('o');
        expect(outline()).toHaveTextContent('Group');
        press('O', { shiftKey: true });
        expect(outline()).not.toBeInTheDocument();
        press('o');
        fireEvent.click(screen.getByRole('button', { name: 'Controls' }));
        expect(store.getState().focus.entity).toBe('grp_b');
        expect(outline()).not.toBeInTheDocument();
    });

    it('a letter typed with Caps Lock runs its Shift shortcut', () => {
        const { store } = setup();
        act(() => store.getState().focusSlot('slot:grp_a:name'));
        press('J');
        expect(store.getState().focus.entity).toBe('grp_b');
    });

    it('? opens the shortcut help', () => {
        setup();
        press('?', { shiftKey: true });
        expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toHaveTextContent('next slot');
    });

    it('lists the editing keys in the help', () => {
        setup();
        press('?', { shiftKey: true });
        const keys = within(screen.getByRole('dialog', { name: 'Keyboard shortcuts' }))
            .getAllByRole('row')
            .map((row) => row.firstElementChild?.textContent);
        expect(keys).toEqual(
            expect.arrayContaining(['A', 'Shift+A', 'R', 'Enter', 'N', 'L', 'C', 'Shift+Backspace', ';'])
        );
    });

    it.each([
        ['A', { key: 'a' }],
        ['Enter', { key: 'Enter' }],
        ['R', { key: 'r' }],
        ['Shift+Backspace', { key: 'Backspace', shiftKey: true }],
        [';', { key: ';' }],
    ])('ignores %s typed into a text field', (_, init) => {
        const { store } = setup();
        act(() => store.getState().focusSlot('slot:grp_a:name'));
        const field = document.body.appendChild(document.createElement('input'));
        press(init.key, init, field);
        expect(store.getState().pending).toEqual([]);
        expect(store.getState().panel).toBeNull();
        field.remove();
    });

    it('leaves Enter on a button to the button', () => {
        const { store } = setup();
        act(() => store.getState().focusSlot('slot:grp_a:name'));
        const button = document.body.appendChild(document.createElement('button'));
        press('Enter', {}, button);
        expect(store.getState().panel).toBeNull();
        button.remove();
    });

    it('runs no shortcut while an inspector panel is open', () => {
        const { store } = setup();
        act(() => store.getState().focusSlot('slot:grp_a:name'));
        press('r');
        press('a', {}, screen.getByRole('group', { name: 'reject name' }));
        press('J', { shiftKey: true }, document.body);
        expect(store.getState().pending).toEqual([]);
        expect(store.getState().focus.key).toBe('slot:grp_a:name');
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
        const { store } = setup();
        const field = document.body.appendChild(make());
        press('J', { shiftKey: true }, field);
        press('o', {}, field);
        expect(store.getState().focus.entity).toBe('study');
        expect(store.getState().outlineOpen).toBe(false);
        field.remove();
    });

    it.each(['ctrlKey', 'metaKey', 'altKey'])('leaves a key pressed with %s to the browser', (modifier) => {
        const { store } = setup();
        press('o', { [modifier]: true });
        press('J', { shiftKey: true, [modifier]: true });
        expect(store.getState().outlineOpen).toBe(false);
        expect(store.getState().focus.entity).toBe('study');
    });

    it('runs no shortcut while the help is open', () => {
        const { store } = setup();
        press('?', { shiftKey: true });
        press('J', { shiftKey: true });
        press('o');
        expect(store.getState().focus.entity).toBe('study');
        expect(store.getState().outlineOpen).toBe(false);
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
    const nameOf = (store: ReturnType<typeof setup>['store']) =>
        (store.getState().record.groups as { name: { value: string } }[])[0].name.value;
    const answer = (store: ReturnType<typeof setup>['store'], value: string) =>
        act(() => void answerPending(store, () => withoutIds([rename('inverse-0001', value)])));

    function edited() {
        const rendered = renderWithStore(<ReviewScreen />, makeBundle(record, TEXT, { entities, review }));
        act(() => void rendered.store.getState().emit(rename('edit-0001', 'Cases')));
        answer(rendered.store, 'Patients');
        return rendered;
    }

    it.each(['ctrlKey', 'metaKey'])('Z with %s undoes the last edit, and with Shift too redoes it', (modifier) => {
        const { store } = edited();
        press('z', { [modifier]: true });
        expect(nameOf(store)).toBe('Patients');
        answer(store, 'Cases');
        press('Z', { [modifier]: true, shiftKey: true });
        expect(nameOf(store)).toBe('Cases');
    });

    it('shows the server’s reason for a refused undo', () => {
        const { store } = edited();
        press('z', { ctrlKey: true });
        const [undo] = store.getState().pending;
        act(() => store.getState().refuse([{ op: undo, message: 'the name has changed since' }]));
        expect(screen.getByText(/could not be undone/)).toHaveTextContent(
            'grp_a name: could not be undone (the name has changed since)'
        );
    });

    it('Ctrl+Y redoes', () => {
        const { store } = edited();
        press('z', { ctrlKey: true });
        expect(nameOf(store)).toBe('Patients');
        answer(store, 'Cases');
        press('y', { ctrlKey: true });
        expect(nameOf(store)).toBe('Cases');
    });

    it('leaves Ctrl+Z in a text field to the field’s own undo', () => {
        const { store } = edited();
        const field = document.body.appendChild(document.createElement('input'));
        const notPrevented = fireEvent.keyDown(field, { key: 'z', ctrlKey: true });
        expect(notPrevented).toBe(true);
        expect(nameOf(store)).toBe('Cases');
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
        const { store, container } = edited();
        const field = container.appendChild(make());
        expect(fireEvent.keyDown(field, { key: 'z', ctrlKey: true })).toBe(true);
        expect(nameOf(store)).toBe('Cases');
        expect(store.getState().pending).toEqual([]);
        field.remove();
    });

    it('shows the server’s reason for a refused redo', () => {
        const { store } = edited();
        press('z', { ctrlKey: true });
        answer(store, 'Cases');
        press('z', { ctrlKey: true, shiftKey: true });
        const [redo] = store.getState().pending;
        act(() => store.getState().refuse([{ op: redo, message: 'the name has changed since' }]));
        expect(screen.getByText(/could not be redone/)).toHaveTextContent(
            'grp_a name: could not be redone (the name has changed since)'
        );
    });

    it('redo pressed while its step is unconfirmed waits, then sends once the server answers', () => {
        const { store } = edited();
        press('z', { ctrlKey: true });
        press('z', { ctrlKey: true, shiftKey: true });
        expect(nameOf(store)).toBe('Patients');
        expect(store.getState().pending).toHaveLength(1);
        answer(store, 'Cases');
        expect(nameOf(store)).toBe('Cases');
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

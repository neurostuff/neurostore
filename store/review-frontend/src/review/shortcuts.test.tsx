import { act, fireEvent, screen } from '@testing-library/react';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { renderWithStore } from '../test/render';
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

    it('? opens the shortcut help', () => {
        setup();
        press('?', { shiftKey: true });
        expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toHaveTextContent('next slot');
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

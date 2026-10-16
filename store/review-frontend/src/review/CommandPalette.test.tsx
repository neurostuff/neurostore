import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { renderWithStores } from '../test/render';
import { ReviewScreen } from './ReviewScreen';
import { focusedSpans } from '../test/stores';

const TEXT = '# A paper\n\nWe scanned twenty patients on a 3 T scanner.\n\nControls were matched for age.\n';
const at = (word: string): [number, number] => [TEXT.indexOf(word), TEXT.indexOf(word) + word.length];
const PASSAGE = 'Controls were matched for age.';
const passage: [number, number] = [TEXT.indexOf(PASSAGE), TEXT.indexOf(PASSAGE) + PASSAGE.length];

const record = {
    description: ev('fMRI study', [at('scanned')]),
    groups: [
        { local_id: 'grp_a', name: ev('Patients', [at('patients')]), n: ev(20, [at('twenty')]) },
        { local_id: 'grp_b', name: ev('Controls', [at('Controls')]), age: ev('matched', [at('Controls'), at('age')]) },
    ],
};
const entities = entityRows(row('grp_a', 'Group', 'groups'), row('grp_b', 'Group', 'groups'));

function setup() {
    const view = renderWithStores(<ReviewScreen />, makeBundle(record, TEXT, { entities }));
    return {
        ...view,
        press: (key: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(document.body, { key, ...init }),
    };
}

const openPalette = (press: (key: string, init?: KeyboardEventInit) => void) => {
    act(() => press('k', { ctrlKey: true }));
    return screen.getByRole('dialog', { name: 'Command palette' });
};
const search = (text: string) =>
    fireEvent.change(screen.getByRole('textbox', { name: 'search' }), { target: { value: text } });
const group = (kind: string) => within(screen.getByRole('group', { name: kind }));

describe('the command palette', () => {
    it('opens on Ctrl+K, with the search field focused', () => {
        const { press } = setup();
        const dialog = openPalette(press);
        expect(dialog).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'search' })).toHaveFocus();
    });

    it('leaves Ctrl+K to the browser inside a text field', () => {
        const { stores } = setup();
        const field = document.body.appendChild(document.createElement('input'));
        act(() => void fireEvent.keyDown(field, { key: 'k', ctrlKey: true }));
        expect(stores.view.getState().paletteOpen).toBe(false);
        field.remove();
    });

    it('groups results by kind: entities, slots, values and paper text', () => {
        const { press } = setup();
        openPalette(press);
        search('patients');
        expect(group('entities').getByText('Patients')).toBeInTheDocument();
        expect(group('values').getByText('Patients')).toBeInTheDocument();
        expect(group('paper text').getByText(/We scanned twenty patients/)).toBeInTheDocument();
    });

    it('finds slots by their label and values by their text', () => {
        const { press } = setup();
        openPalette(press);
        search('age');
        expect(group('slots').getByText('age')).toBeInTheDocument();
        search('matched');
        expect(group('values').getByText('matched')).toBeInTheDocument();
    });

    it('focuses an entity it chooses, which scrolls the text to its first evidence', async () => {
        const { press, stores } = setup();
        openPalette(press);
        search('controls');
        fireEvent.click(group('entities').getByRole('option', { name: /Controls/ }));
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument());
        expect(stores.view.getState().focus.entity).toBe('grp_b');
        expect(stores.view.getState().reveal?.span).toEqual(focusedSpans(stores)[0]);
    });

    it('focuses a slot it chooses', () => {
        const { press, stores } = setup();
        openPalette(press);
        search('age');
        fireEvent.click(group('slots').getByRole('option', { name: /^age Controls/ }));
        expect(stores.view.getState().focus.key).toBe('slot:grp_b:age');
    });

    it('focuses the slot of a value it chooses', () => {
        const { press, stores } = setup();
        openPalette(press);
        search('matched');
        fireEvent.click(group('values').getByRole('option', { name: /^matched/ }));
        expect(stores.view.getState().focus.key).toBe('slot:grp_b:age');
    });

    it('scrolls the text to a passage it chooses', () => {
        const { press, stores } = setup();
        openPalette(press);
        search('matched for');
        fireEvent.click(group('paper text').getByRole('option', { name: new RegExp(PASSAGE) }));
        expect(stores.view.getState().reveal?.span).toEqual(passage);
    });

    it('moves the active result with the arrow keys, and chooses it with Enter', () => {
        const { press, stores } = setup();
        openPalette(press);
        search('patients');
        const input = screen.getByRole('textbox', { name: 'search' });
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        expect(group('values').getByRole('option', { name: /^Patients/ })).toHaveAttribute('aria-selected', 'true');
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(stores.view.getState().focus.key).toBe('slot:grp_a:name');
    });

    it('closes on Escape without choosing anything', async () => {
        const { press, stores } = setup();
        openPalette(press);
        fireEvent.keyDown(screen.getByRole('textbox', { name: 'search' }), { key: 'Escape' });
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument());
        expect(stores.view.getState().focus.key).toBe('entity:study');
    });
});

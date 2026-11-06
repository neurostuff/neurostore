import { act, fireEvent, screen, within } from '@testing-library/react';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { renderWithStores } from '../test/render';
import { ReviewScreen } from './ReviewScreen';

const TEXT = 'Twenty patients and twenty controls performed a Stroop task during a 3 T fMRI scan.';
const at = (word: string): [number, number] => [TEXT.indexOf(word), TEXT.indexOf(word) + word.length];

const bundle = makeBundle(
    {
        analyses: [
            {
                local_id: 'a_1',
                name: ev('Patients > Controls', [at('patients')]),
                statistic: ev('t', [at('Stroop')]),
            },
        ],
        groups: [{ local_id: 'grp_a', name: ev('Patients', [at('patients')]) }],
    },
    TEXT,
    { entities: entityRows(row('a_1', 'Analysis', 'analyses'), row('grp_a', 'Group', 'groups')) }
);

function setup() {
    const view = renderWithStores(<ReviewScreen />, bundle);
    act(() => view.stores.view.getState().setStep('analyses'));
    act(() => view.stores.view.getState().focusSlot('slot:a_1:statistic'));
    return view;
}

const head = () => screen.getByRole('group', { name: 'Patients > Controls: card head' });
const headButton = (name: string) => within(head()).getByRole('button', { name });

describe('the actions on a card', () => {
    it('has no toolbar of actions above the cards', () => {
        setup();
        expect(screen.queryByRole('toolbar', { name: 'review actions' })).not.toBeInTheDocument();
    });

    it('puts the card’s own actions on its head, named for its kind, each with its key', () => {
        setup();
        const actions = within(head())
            .getAllByRole('button')
            .filter((b) => b.hasAttribute('aria-keyshortcuts'))
            .map((b) => [b.textContent, b.getAttribute('aria-keyshortcuts')]);
        expect(actions).toEqual([
            ['Accept analysis', 'Shift+A'],
            ['Reject analysis', 'r'],
            ['New analysis', 'c'],
            ['Delete analysis', 'Shift+Backspace'],
            ['Note', ';'],
        ]);
    });

    it('rejects and notes the entity from its head, though a field is focused', () => {
        const { stores } = setup();
        fireEvent.click(headButton('Note'));
        expect(stores.view.getState().panel).toMatchObject({ kind: 'note', target: { kind: 'entity', entity: 'a_1' } });
        fireEvent.click(headButton('Reject analysis'));
        expect(stores.view.getState().panel).toMatchObject({
            kind: 'reject',
            target: { kind: 'entity', entity: 'a_1' },
        });
    });

    it('creates and deletes the entity from its head', () => {
        const { stores } = setup();
        act(() => stores.view.getState().setStep('leftovers'));
        act(() => stores.view.getState().focusEntity('grp_a'));
        const groupHead = screen.getByRole('group', { name: 'Patients: card head' });
        fireEvent.click(within(groupHead).getByRole('button', { name: 'New group' }));
        expect(stores.session.getState().pending).toMatchObject([{ type: 'create_entity', list: 'groups' }]);
        fireEvent.click(within(groupHead).getByRole('button', { name: 'Delete group' }));
        expect(screen.getByRole('dialog', { name: 'Delete Patients?' })).toBeInTheDocument();
    });

    it('says on hover why a card action does not apply', () => {
        const { stores } = setup();
        act(() => stores.view.getState().setStep('leftovers'));
        act(() => stores.view.getState().focusEntity('study'));
        expect(screen.getByRole('button', { name: 'Delete study' })).toHaveAttribute(
            'title',
            'The study itself cannot be deleted'
        );
    });

    it('offers Not reported beside the focused field, where it applies', () => {
        setup();
        const field = screen.getByRole('toolbar', { name: 'actions on Statistic' });
        expect(within(field).getByRole('button', { name: 'Not reported' })).toHaveAttribute('aria-keyshortcuts', 'n');
    });
});

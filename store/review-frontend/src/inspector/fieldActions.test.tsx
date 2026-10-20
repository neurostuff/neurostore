import { act, fireEvent, screen, within } from '@testing-library/react';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import type { Op } from '../contract/generated/review-ops';
import { renderWithStores } from '../test/render';
import { answerPending, withoutIds } from '../test/undoHelpers';
import { Inspector } from './FocusedCard';

const TEXT = 'x'.repeat(200);

const record = {
    groups: [{ local_id: 'grp_a', name: ev('Patients', [[50, 58]]), acquired_count: ev(20, [[60, 62]]) }],
    measures: [{ local_id: 'mea_1', source_label: ev('BOLD', [[80, 84]]) }],
    analyses: [{ local_id: 'a_1', name: ev('Patients > Controls', [[120, 140]]), measure: 'mea_1' }],
};

const entities = entityRows(
    row('grp_a', 'Group', 'groups'),
    row('mea_1', 'Measure', 'measures'),
    row('a_1', 'Analysis', 'analyses')
);

const review = { id: 'r1', user_id: 'me', state: 'in_progress' as const, last_seq: 0, provenance: {}, annotations: {} };

function setup(started = false) {
    const view = renderWithStores(<Inspector />, makeBundle(record, TEXT, { entities, ...(started && { review }) }));
    return { ...view, viewState: () => view.stores.view.getState() };
}

const rowOf = (key: string) => document.querySelector<HTMLElement>(`[data-slot-key="${key}"]`)!;
const fieldActions = () => screen.queryAllByRole('toolbar', { name: /^actions on / });

describe('the record actions, with no toolbar', () => {
    const head = (name: string) => screen.getByRole('group', { name: `${name}: card head` });
    const labels = (holder: HTMLElement) =>
        within(holder)
            .getAllByRole('button')
            .filter((b) => b.hasAttribute('aria-keyshortcuts'))
            .map((b) => b.textContent);

    it('keeps each action the toolbar had, beside the focused field or on the card head', () => {
        const { viewState } = setup();
        expect(screen.queryByRole('toolbar', { name: 'review actions' })).not.toBeInTheDocument();
        act(() => viewState().focusSlot('slot:grp_a:acquired_count'));
        expect(labels(fieldActions()[0])).toEqual(['Accept', 'Reject', 'Edit', 'Not reported', 'Note', 'Move to…']);
        expect(labels(head('Patients'))).toEqual(['Accept group', 'Reject group', 'New group', 'Delete group', 'Note']);
        act(() => viewState().focusSlot('slot:a_1:measure'));
        expect(labels(fieldActions()[0])).toEqual(['Accept', 'Reject', 'Link', 'Note']);
    });

    it('says why the study itself cannot be deleted, on its head', () => {
        const { viewState } = setup();
        act(() => viewState().focusEntity('study'));
        const button = within(head('Study')).getByRole('button', { name: 'Delete study' });
        expect(button).toBeDisabled();
        expect(button).toHaveAttribute('title', 'The study itself cannot be deleted');
    });
});

describe('actions beside the focused field (D97)', () => {
    it('appear on the focused field only', () => {
        const { viewState } = setup();
        act(() => viewState().focusEntity('grp_a'));
        expect(fieldActions()).toEqual([]);
        act(() => viewState().focusSlot('slot:grp_a:acquired_count'));
        expect(fieldActions()).toHaveLength(1);
        const [actions] = fieldActions();
        const details = screen.getByRole('region', { name: 'Selected field' });
        expect(details).toContainElement(actions);
        expect(details).toHaveTextContent(/^Selected · About · Acquired count/);
        expect(
            within(actions)
                .getAllByRole('button')
                .map((b) => b.textContent)
        ).toEqual(['Accept', 'Reject', 'Edit', 'Not reported', 'Note', 'Move to…']);
    });

    it('do not follow the pointer to another field', () => {
        const { viewState } = setup();
        act(() => viewState().focusSlot('slot:grp_a:acquired_count'));
        fireEvent.mouseOver(rowOf('slot:grp_a:name'));
        fireEvent.mouseEnter(rowOf('slot:grp_a:name'));
        expect(fieldActions()).toHaveLength(1);
    });

    it('offer Link, not Edit, on a reference field', () => {
        const { viewState } = setup();
        act(() => viewState().focusSlot('slot:a_1:measure'));
        const [actions] = fieldActions();
        expect(
            within(actions)
                .getAllByRole('button')
                .map((b) => b.textContent)
        ).toEqual(['Accept', 'Reject', 'Link', 'Note']);
    });

    it('accept the field they sit beside', () => {
        const { stores, viewState } = setup();
        act(() => viewState().focusSlot('slot:grp_a:acquired_count'));
        fireEvent.click(within(fieldActions()[0]).getByRole('button', { name: 'Accept' }));
        expect(stores.session.getState().pending).toEqual([
            expect.objectContaining({
                type: 'verdict',
                verdict: 'accept',
                target: { kind: 'slot', entity: 'grp_a', path: 'acquired_count' },
            }),
        ]);
    });

    it('name their key in a tooltip', () => {
        const { viewState } = setup();
        act(() => viewState().focusSlot('slot:grp_a:acquired_count'));
        const edit = within(fieldActions()[0]).getByRole('button', { name: 'Edit' });
        expect(edit).toHaveAttribute('title', 'edit the focused value; Enter saves, Esc cancels (Enter)');
    });

    it('leave while a panel is open on the field', () => {
        const { viewState } = setup();
        act(() => viewState().focusSlot('slot:grp_a:acquired_count'));
        fireEvent.click(within(fieldActions()[0]).getByRole('button', { name: 'Edit' }));
        expect(fieldActions()).toEqual([]);
    });
});

describe('double-clicking a field', () => {
    it('opens its value in the editor', () => {
        const { viewState } = setup();
        act(() => viewState().focusEntity('grp_a'));
        fireEvent.doubleClick(rowOf('slot:grp_a:acquired_count'));
        expect(screen.getByRole('group', { name: 'edit Acquired count' })).toBeInTheDocument();
    });

    it('opens the link picker on a reference field', () => {
        const { viewState } = setup();
        act(() => viewState().focusEntity('a_1'));
        fireEvent.doubleClick(rowOf('slot:a_1:measure'));
        expect(screen.getByRole('combobox', { name: 'link Measure to' })).toBeInTheDocument();
    });
});

describe('moving the focused evidence span (D2)', () => {
    it('moves it to the field chosen, as one undo step', async () => {
        const { stores, viewState } = setup();
        act(() => viewState().focusSlot('slot:grp_a:name'));
        fireEvent.click(within(fieldActions()[0]).getByRole('button', { name: 'Move to…' }));
        const picker = screen.getByRole('combobox', { name: 'move this evidence to' });
        fireEvent.change(picker, { target: { value: 'Acquired' } });
        fireEvent.click(await screen.findByRole('option', { name: 'Patients · Acquired count' }));
        expect(stores.session.getState().index.slot('slot:grp_a:name')?.spans).toEqual([]);
        expect(stores.session.getState().index.slot('slot:grp_a:acquired_count')?.spans).toEqual([
            [50, 58],
            [60, 62],
        ]);
        expect(stores.session.getState().undoStack).toHaveLength(1);
    });

    it('is undone by one undo, which puts the span back in both fields', async () => {
        const { stores, viewState } = setup(true);
        const slotOf = (key: string) => stores.session.getState().index.slot(key)!;
        const evidenceBefore = {
            name: slotOf('slot:grp_a:name').value!.evidence!,
            acquired_count: slotOf('slot:grp_a:acquired_count').value!.evidence!,
        };
        act(() => viewState().focusSlot('slot:grp_a:name'));
        fireEvent.click(within(fieldActions()[0]).getByRole('button', { name: 'Move to…' }));
        fireEvent.change(screen.getByRole('combobox', { name: 'move this evidence to' }), {
            target: { value: 'Acquired' },
        });
        fireEvent.click(await screen.findByRole('option', { name: 'Patients · Acquired count' }));
        act(
            () =>
                void answerPending(stores, (op) =>
                    withoutIds([
                        {
                            client_op_id: 'inverse',
                            type: 'set_evidence',
                            target: (op as { target: { path: 'name' | 'acquired_count' } }).target,
                            evidence:
                                evidenceBefore[(op as { target: { path: 'name' | 'acquired_count' } }).target.path],
                        } as Op,
                    ])
                )
        );
        act(() => stores.session.getState().undo());
        expect(slotOf('slot:grp_a:name').spans).toEqual([[50, 58]]);
        expect(slotOf('slot:grp_a:acquired_count').spans).toEqual([[60, 62]]);
    });

    it('is not offered on a field with no evidence', () => {
        const { stores, viewState } = setup();
        act(() => void stores.session.getState().removeEvidence('slot:grp_a:name', [50, 58]));
        act(() => viewState().focusSlot('slot:grp_a:name'));
        expect(within(fieldActions()[0]).queryByRole('button', { name: 'Move to…' })).not.toBeInTheDocument();
    });
});

describe('notes (E1, E2)', () => {
    it('saves a note from the note field’s Save button, and closes it with Cancel', () => {
        const { stores, viewState } = setup();
        act(() => viewState().focusSlot('slot:grp_a:acquired_count'));
        fireEvent.click(within(fieldActions()[0]).getByRole('button', { name: 'Note' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'note on Acquired count' }), {
            target: { value: 'twenty in table 1' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
        expect(stores.session.getState().pending).toEqual([
            expect.objectContaining({ type: 'note', note: 'twenty in table 1' }),
        ]);
        fireEvent.click(within(fieldActions()[0]).getByRole('button', { name: 'Note' }));
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('textbox', { name: 'note on Acquired count' })).not.toBeInTheDocument();
    });

    it('marks a noted slot, the note on hover', () => {
        const { stores, viewState } = setup();
        act(() => viewState().focusEntity('grp_a'));
        expect(within(rowOf('slot:grp_a:acquired_count')).queryByLabelText(/^noted/)).not.toBeInTheDocument();
        act(
            () =>
                void stores.session.getState().emit({
                    client_op_id: 'note-1',
                    type: 'note',
                    target: { kind: 'slot', entity: 'grp_a', path: 'acquired_count' },
                    note: 'twenty in table 1',
                })
        );
        const mark = within(rowOf('slot:grp_a:acquired_count')).getByLabelText('noted: twenty in table 1');
        expect(mark).toHaveAttribute('title', 'twenty in table 1');
    });
});

describe('a noted entity', () => {
    it('is marked on its card head', () => {
        const { stores, viewState } = setup();
        act(() => viewState().focusEntity('grp_a'));
        act(
            () =>
                void stores.session.getState().emit({
                    client_op_id: 'note-2',
                    type: 'note',
                    target: { kind: 'entity', entity: 'grp_a' },
                    note: 'two groups pooled',
                })
        );
        const card = screen.getByRole('region', { name: 'Patients' });
        expect(within(card).getAllByLabelText('noted: two groups pooled')).toHaveLength(1);
    });
});

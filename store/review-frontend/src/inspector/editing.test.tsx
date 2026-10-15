import { act, fireEvent, screen, within } from '@testing-library/react';
import type { Op } from '../contract/generated/review-ops';
import { ReviewScreen } from '../review/ReviewScreen';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { renderWithStore } from '../test/render';
import { validateOpBatch } from '../test/schemas';

const TEXT = 'We scanned twenty patients and twenty controls on a 3 T scanner.';
const at = (word: string): [number, number] => [TEXT.indexOf(word), TEXT.indexOf(word) + word.length];

const record = {
    groups: [
        {
            local_id: 'grp_a',
            name: ev('Patients', [at('patients')]),
            acquired_count: ev(20, [at('twenty')]),
            species: ev('human', [at('patients')]),
            is_healthy: ev(false),
        },
        { local_id: 'grp_b', name: ev('Controls', [at('controls')]) },
    ],
    acquisitions: [
        { local_id: 'acq_1', acquisition_type: 'MRI', name: ev('Scan A') },
        { local_id: 'acq_2', acquisition_type: 'MRI', name: ev('Scan B') },
    ],
    analyses: [
        {
            local_id: 'a_1',
            name: ev('Patients > Controls', [at('scanner')]),
            acquisitions: ['acq_1'],
            groups: [{ group: 'grp_a', n: ev(20, [at('twenty')]) }],
        },
    ],
};

const entities = entityRows(
    row('grp_a', 'Group', 'groups'),
    row('grp_b', 'Group', 'groups'),
    row('acq_1', 'Acquisition', 'acquisitions', { schema_class: 'MRI' }),
    row('acq_2', 'Acquisition', 'acquisitions', { schema_class: 'MRI' }),
    row('a_1', 'Analysis', 'analyses')
);

const review = {
    id: 'r1',
    user_id: 'u1',
    state: 'in_progress',
    last_seq: 0,
    provenance: {},
    annotations: {},
} as const;

function setup() {
    const view = renderWithStore(<ReviewScreen />, makeBundle(record, TEXT, { entities, review: { ...review } }));
    const state = () => view.store.getState();
    const pending = () => state().pending;
    const last = () => pending().at(-1);
    return { ...view, state, pending, last };
}

const press = (key: string, init: KeyboardEventInit = {}, target: Element = document.activeElement ?? document.body) =>
    act(() => void fireEvent.keyDown(target, { key, ...init }));

const rowOf = (key: string) => document.querySelector<HTMLElement>(`[data-slot-key="${key}"]`)!;
const statusIn = (key: string) => rowOf(key).querySelector('[data-status-shape]');
const reviewIn = (key: string, id: string) => rowOf(key).querySelector(`[data-status="${id}"]`);

function expectValid(...ops: (Op | undefined)[]) {
    expect(validateOpBatch({ ops }), JSON.stringify(validateOpBatch.errors)).toBe(true);
}

describe('editing a slot', () => {
    it('Enter edits the focused value in the editor its schema calls for; Enter saves one set_value', () => {
        const { state, pending, last } = setup();
        act(() => state().focusSlot('slot:grp_a:acquired_count'));
        press('Enter', {}, document.body);
        const field = screen.getByRole('spinbutton', { name: 'acquired_count' });
        expect(field).toHaveFocus();
        expect(field).toHaveAttribute('step', '1');
        fireEvent.change(field, { target: { value: '2.5' } });
        press('Enter');
        expect(field).toHaveAccessibleDescription('must be a whole number');
        expect(pending()).toEqual([]);
        fireEvent.change(field, { target: { value: '18' } });
        press('Enter');
        expect(pending()).toHaveLength(1);
        expect(last()).toMatchObject({
            type: 'set_value',
            target: { kind: 'slot', entity: 'grp_a', path: 'acquired_count' },
            value: { extraction_status: 'extracted', value: 18, value_source: 'reported' },
        });
        expectValid(last());
        expect(screen.queryByRole('group', { name: 'edit acquired_count' })).not.toBeInTheDocument();
        expect(rowOf('slot:grp_a:acquired_count')).toHaveTextContent('18');
        expect(reviewIn('slot:grp_a:acquired_count', 'edited')).toHaveTextContent('edited');
    });

    it('Esc cancels the edit, emitting nothing', () => {
        const { state, pending } = setup();
        act(() => state().focusSlot('slot:grp_a:name'));
        press('Enter', {}, document.body);
        fireEvent.change(screen.getByRole('textbox', { name: 'name' }), { target: { value: 'Cases' } });
        press('Escape');
        expect(screen.queryByRole('group', { name: 'edit name' })).not.toBeInTheDocument();
        expect(pending()).toEqual([]);
        expect(state().panel).toBeNull();
    });

    it('gives a boolean slot a switch and an open vocabulary a text field with suggestions', () => {
        const { state } = setup();
        act(() => state().focusSlot('slot:grp_a:is_healthy'));
        press('Enter', {}, document.body);
        expect(screen.getByRole('switch', { name: 'is_healthy' })).not.toBeChecked();
        press('Escape');
        act(() => state().focusSlot('slot:grp_a:species'));
        press('Enter', {}, document.body);
        expect(screen.getByRole('combobox', { name: 'species' })).toHaveValue('human');
    });

    it('N marks the slot not reported with a reason from the schema, as one set_value', () => {
        const { state, last } = setup();
        act(() => state().focusSlot('slot:grp_a:name'));
        press('n', {}, document.body);
        const reason = screen.getByRole('combobox', { name: 'unreported reason' });
        expect(reason).toHaveFocus();
        fireEvent.change(reason, { target: { value: 'cited_elsewhere' } });
        press('Enter');
        expect(last()).toMatchObject({
            type: 'set_value',
            target: { kind: 'slot', entity: 'grp_a', path: 'name' },
            value: { extraction_status: 'not_reported', unreported_reason: 'cited_elsewhere' },
        });
        expectValid(last());
        expect(rowOf('slot:grp_a:name')).toHaveTextContent('not reported (cited_elsewhere)');
    });
});

describe('verdicts and notes', () => {
    it('A accepts the focused slot, and its status reads verified', () => {
        const { state, last } = setup();
        act(() => state().focusSlot('slot:grp_a:name'));
        expect(statusIn('slot:grp_a:name')).toHaveTextContent('evidence present');
        press('a', {}, document.body);
        expect(last()).toMatchObject({
            type: 'verdict',
            verdict: 'accept',
            target: { kind: 'slot', entity: 'grp_a', path: 'name' },
        });
        expectValid(last());
        expect(reviewIn('slot:grp_a:name', 'verified')).toHaveTextContent('verified');
        expect(reviewIn('slot:grp_a:name', 'verified')).toHaveAttribute('data-status-shape', 'check');
        expect(statusIn('slot:grp_a:name')).toHaveTextContent('evidence present');
    });

    it('A accepts the focused entity, shown on its card', () => {
        const { state, last } = setup();
        act(() => state().focusEntity('grp_b'));
        press('a', {}, document.body);
        expect(last()).toMatchObject({
            type: 'verdict',
            verdict: 'accept',
            target: { kind: 'entity', entity: 'grp_b' },
        });
        expectValid(last());
        const card = screen.getByRole('region', { name: 'Controls' });
        expect(within(card).getByText('verified')).toBeInTheDocument();
    });

    it('A accepts the focused link', () => {
        const { state, last } = setup();
        act(() => state().focusEntity('a_1'));
        const chip = within(rowOf('slot:a_1:acquisitions')).getByRole('button', { name: 'Scan A' });
        act(() => chip.focus());
        press('a');
        expect(last()).toMatchObject({
            type: 'verdict',
            verdict: 'accept',
            target: { kind: 'relationship', entity: 'a_1', path: 'acquisitions', target_entity: 'acq_1' },
        });
        expectValid(last());
    });

    it('Shift+A accepts every untouched slot on the card that has evidence, in one batch', () => {
        const { state, pending } = setup();
        act(() => state().focusSlot('slot:grp_a:name'));
        press('a', {}, document.body);
        press('A', { shiftKey: true }, document.body);
        const accepted = pending().slice(1);
        expect(
            accepted.map((op) => op.type === 'verdict' && op.target.kind === 'slot' && op.target.path).sort()
        ).toEqual(['acquired_count', 'species']);
        expect(accepted.every((op) => op.type === 'verdict' && op.verdict === 'accept')).toBe(true);
        expectValid(...accepted);
        expect(statusIn('slot:grp_a:is_healthy')).toHaveTextContent('evidence not found');
    });

    it('R opens the reason chips; a digit picks one, and Enter rejects with the note', () => {
        const { state, last } = setup();
        act(() => state().focusSlot('slot:grp_a:species'));
        press('r', {}, document.body);
        const panel = screen.getByRole('group', { name: 'reject species' });
        expect(
            within(panel)
                .getAllByRole('radio')
                .map((r) => r.getAttribute('aria-label') ?? r.textContent)
        ).toEqual(['1 wrong value', '2 not in text', '3 wrong entity', '4 duplicate', '5 other']);
        press('3');
        expect(within(panel).getByRole('radio', { name: '3 wrong entity' })).toBeChecked();
        const note = within(panel).getByRole('textbox', { name: 'note' });
        expect(note).toHaveFocus();
        fireEvent.change(note, { target: { value: 'this is the control group' } });
        press('Enter');
        expect(last()).toMatchObject({
            type: 'verdict',
            verdict: 'reject',
            reason: 'wrong_entity',
            note: 'this is the control group',
            target: { kind: 'slot', entity: 'grp_a', path: 'species' },
        });
        expectValid(last());
        expect(reviewIn('slot:grp_a:species', 'rejected')).toHaveAttribute('data-status-shape', 'cross');
    });

    it('a digit pressed on a reason radio picks that reason, and one typed in the note does not', () => {
        const { state } = setup();
        act(() => state().focusSlot('slot:grp_a:species'));
        press('r', {}, document.body);
        const panel = screen.getByRole('group', { name: 'reject species' });
        press('2', {}, within(panel).getByRole('radio', { name: '1 wrong value' }));
        expect(within(panel).getByRole('radio', { name: '2 not in text' })).toBeChecked();
        const note = within(panel).getByRole('textbox', { name: 'note' });
        fireEvent.change(note, { target: { value: 'page 4 7' } });
        press('5', {}, note);
        expect(within(panel).getByRole('radio', { name: '2 not in text' })).toBeChecked();
        expect(within(panel).getByRole('radio', { name: '5 other' })).not.toBeChecked();
    });

    it('a reject with the reason other needs a note', () => {
        const { state, pending } = setup();
        act(() => state().focusSlot('slot:grp_a:species'));
        press('r', {}, document.body);
        press('5');
        const note = screen.getByRole('textbox', { name: 'note' });
        press('Enter');
        expect(pending()).toEqual([]);
        expect(note).toHaveAccessibleDescription('a note is required with “other”');
        press('Escape');
        expect(screen.queryByRole('group', { name: 'reject species' })).not.toBeInTheDocument();
    });

    it('a reject without a picked reason asks for one', () => {
        const { state, pending } = setup();
        act(() => state().focusSlot('slot:grp_a:species'));
        press('r', {}, document.body);
        press('Enter');
        expect(pending()).toEqual([]);
        expect(screen.getByRole('radiogroup', { name: 'reason' })).toHaveAccessibleDescription('pick a reason, 1–5');
    });

    it('N on an entity does nothing and opens no panel', () => {
        const { state, pending } = setup();
        act(() => state().focusEntity('grp_b'));
        press('n', {}, document.body);
        expect(state().panel).toBeNull();
        expect(pending()).toEqual([]);
    });

    it('a note left empty is refused, with no op', () => {
        const { state, pending } = setup();
        act(() => state().focusEntity('grp_b'));
        press(';', {}, document.body);
        press('Enter');
        expect(pending()).toEqual([]);
        expect(screen.getByRole('textbox', { name: 'note on Controls' })).toHaveAccessibleDescription(
            'write a note first'
        );
    });

    it('; adds a note to the focused item', () => {
        const { state, last } = setup();
        act(() => state().focusEntity('grp_b'));
        press(';', {}, document.body);
        const note = screen.getByRole('textbox', { name: 'note on Controls' });
        expect(note).toHaveFocus();
        fireEvent.change(note, { target: { value: 'check the methods' } });
        press('Enter');
        expect(last()).toMatchObject({
            type: 'note',
            note: 'check the methods',
            target: { kind: 'entity', entity: 'grp_b' },
        });
        expectValid(last());
        expect(screen.queryByRole('textbox', { name: 'note on Controls' })).not.toBeInTheDocument();
    });

    it('; adds a note to the focused slot, and to the focused link', () => {
        const { state, last } = setup();
        act(() => state().focusSlot('slot:grp_a:name'));
        press(';', {}, document.body);
        fireEvent.change(screen.getByRole('textbox', { name: 'note on name' }), {
            target: { value: 'check the label' },
        });
        press('Enter');
        expect(last()).toMatchObject({
            type: 'note',
            note: 'check the label',
            target: { kind: 'slot', entity: 'grp_a', path: 'name' },
        });
        expectValid(last());
        act(() => state().focusEntity('a_1'));
        const chip = within(rowOf('slot:a_1:acquisitions')).getByRole('button', { name: 'Scan A' });
        act(() => chip.focus());
        press(';');
        fireEvent.change(screen.getByRole('textbox', { name: /^note on/ }), { target: { value: 'the scanner' } });
        press('Enter');
        expect(last()).toMatchObject({
            type: 'note',
            note: 'the scanner',
            target: { kind: 'relationship', entity: 'a_1', path: 'acquisitions', target_entity: 'acq_1' },
        });
        expectValid(last());
    });
});

describe('the status a review gives an entity', () => {
    it('shows an entity the server created as added, on its card', () => {
        const { store } = renderWithStore(
            <ReviewScreen />,
            makeBundle(record, TEXT, {
                entities,
                review: { ...review, provenance: { 'entity:grp_b': { state: 'added', user_id: 'u1', at: 'then' } } },
            })
        );
        act(() => store.getState().focusEntity('grp_b'));
        expect(within(screen.getByRole('region', { name: 'Controls' })).getByText('added')).toBeInTheDocument();
    });
});

describe('links and entities', () => {
    it('L opens a type-ahead over entities of the slot’s class; choosing one emits link, pending until the server answers', () => {
        const { state, last } = setup();
        act(() => state().focusSlot('slot:a_1:acquisitions'));
        press('l', {}, document.body);
        const input = screen.getByRole('combobox', { name: 'link acquisitions to' });
        expect(input).toHaveFocus();
        fireEvent.change(input, { target: { value: 'Scan' } });
        expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Scan B']);
        fireEvent.click(screen.getByRole('option', { name: 'Scan B' }));
        expect(last()).toMatchObject({
            type: 'link',
            target: { kind: 'relationship', entity: 'a_1', path: 'acquisitions', target_entity: 'acq_2' },
        });
        expectValid(last());
        expect(within(rowOf('slot:a_1:acquisitions')).getByText('Scan B · linking')).toBeInTheDocument();
    });

    it('a chip’s remove button emits unlink, shown pending', () => {
        const { state, last } = setup();
        act(() => state().focusEntity('a_1'));
        fireEvent.click(within(rowOf('slot:a_1:acquisitions')).getByRole('button', { name: 'unlink Scan A' }));
        expect(last()).toMatchObject({
            type: 'unlink',
            target: { kind: 'relationship', entity: 'a_1', path: 'acquisitions', target_entity: 'acq_1' },
        });
        expectValid(last());
        expect(within(rowOf('slot:a_1:acquisitions')).getByText('Scan A · unlinking')).toBeInTheDocument();
    });

    it('C creates an entity in the focused entity’s list with a minted id, shown pending', async () => {
        const { state, last } = setup();
        act(() => state().focusEntity('grp_b'));
        press('c', {}, document.body);
        expect(last()).toMatchObject({ type: 'create_entity', parent: 'study', list: 'groups', entity: {} });
        await act(() => state().minted(last()!.client_op_id));
        expect(last()).toMatchObject({ entity: { local_id: expect.stringMatching(/^rv_[0-9a-f]{12}$/) } });
        expectValid(last());
        expect(screen.getByRole('status', { name: 'pending changes' })).toHaveTextContent(
            'creating an entity in groups'
        );
    });

    it('clears the pending markers once the server’s answer lands', async () => {
        const { state, last } = setup();
        act(() => state().focusEntity('grp_b'));
        press('c', {}, document.body);
        await act(() => state().minted(last()!.client_op_id));
        const created = last()!;
        const localId = (created as unknown as { entity: { local_id: string } }).entity.local_id;
        expect(screen.getByRole('status', { name: 'pending changes' })).toBeInTheDocument();
        act(() =>
            state().confirm(
                {
                    ops: [{ seq: 1, op: created, before: {}, after: {}, user_id: 'u1', created_at: 'then' }],
                    last_seq: 1,
                    record: state().record,
                    coordinate_revision: null,
                    provenance: {},
                    annotations: {},
                    hidden: { analyses: [], entities: [] },
                    entities: [...state().bundle.entities, row(localId, 'Group', 'groups')],
                },
                [created]
            )
        );
        expect(state().pending).toEqual([]);
        expect(screen.getByRole('status', { name: 'pending changes' })).not.toHaveTextContent('creating');
    });

    it('Shift+Backspace confirms, listing the dangling links, then deletes the focused entity', () => {
        const { state, last, pending } = setup();
        act(() => state().focusEntity('grp_a'));
        press('Backspace', { shiftKey: true }, document.body);
        const dialog = screen.getByRole('dialog', { name: 'Delete Patients?' });
        expect(within(dialog).getByRole('list', { name: 'dangling links' })).toHaveTextContent(
            'Patients > Controls · groups[#0].group → Patients'
        );
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
        expect(pending()).toEqual([]);
        press('Backspace', { shiftKey: true }, document.body);
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
        expect(last()).toMatchObject({ type: 'delete_entity', target: { kind: 'entity', entity: 'grp_a' } });
        expectValid(last());
        expect(within(screen.getByRole('region', { name: 'Patients' })).getByText('deleting…')).toBeInTheDocument();
    });

    it('closes the delete dialog on confirm, before the server answers', () => {
        const { state, pending } = setup();
        act(() => state().focusEntity('grp_a'));
        press('Backspace', { shiftKey: true }, document.body);
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(pending()).toHaveLength(1);
    });

    it('says when nothing links to the entity being deleted', () => {
        const { state } = setup();
        act(() => state().focusEntity('grp_b'));
        press('Backspace', { shiftKey: true }, document.body);
        expect(screen.getByRole('dialog', { name: 'Delete Controls?' })).toHaveTextContent('Nothing links to it.');
    });

    it('does not offer to delete the study', () => {
        setup();
        press('Backspace', { shiftKey: true }, document.body);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});

describe('keyboard paths', () => {
    it('Delete on a focused link chip unlinks it', () => {
        const { state, last } = setup();
        act(() => state().focusEntity('a_1'));
        const chip = within(rowOf('slot:a_1:acquisitions')).getByRole('button', { name: 'Scan A' });
        act(() => chip.focus());
        fireEvent.keyDown(chip, { key: 'Delete' });
        fireEvent.keyUp(chip, { key: 'Delete' });
        expect(last()).toMatchObject({ type: 'unlink', target: { target_entity: 'acq_1' } });
    });

    it('Esc closes the link type-ahead without linking', () => {
        const { state, pending } = setup();
        act(() => state().focusSlot('slot:a_1:acquisitions'));
        press('l', {}, document.body);
        press('Escape', {}, screen.getByRole('combobox', { name: 'link acquisitions to' }));
        expect(screen.queryByRole('combobox', { name: 'link acquisitions to' })).not.toBeInTheDocument();
        expect(pending()).toEqual([]);
    });

    it('the delete dialog focuses Delete, so Enter confirms, and Esc cancels', () => {
        const { state, pending } = setup();
        act(() => state().focusEntity('grp_b'));
        press('Backspace', { shiftKey: true }, document.body);
        const dialog = screen.getByRole('dialog', { name: 'Delete Controls?' });
        expect(within(dialog).getByRole('button', { name: 'Delete' })).toHaveFocus();
        press('Escape');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(state().panel).toBeNull();
        expect(pending()).toEqual([]);
    });

    it('L and Enter do nothing where they do not apply', () => {
        const { state } = setup();
        act(() => state().focusSlot('slot:grp_a:name'));
        press('l', {}, document.body);
        expect(state().panel).toBeNull();
        act(() => state().focusSlot('slot:a_1:acquisitions'));
        press('Enter', {}, document.body);
        expect(state().panel).toBeNull();
    });
});

describe('creating, and the actions for a pointer', () => {
    it('C builds the new entity with its required slots not reported', () => {
        const { state, last } = setup();
        act(() => state().focusEntity('grp_b'));
        press('c', {}, document.body);
        expect(last()).toMatchObject({
            type: 'create_entity',
            parent: 'study',
            list: 'groups',
            entity: {
                name: { extraction_status: 'not_reported', evidence: { status: 'not_applicable' } },
                species: { extraction_status: 'not_reported', evidence: { status: 'not_applicable' } },
            },
        });
    });

    it('C on a list of subclasses asks which class first, and creates the one chosen', () => {
        const { state, last, pending } = setup();
        act(() => state().focusEntity('acq_1'));
        press('c', {}, document.body);
        const kinds = within(screen.getByRole('dialog')).getByRole('list', { name: 'kinds' });
        expect(
            within(kinds)
                .getAllByRole('button')
                .map((b) => b.textContent)
        ).toEqual(expect.arrayContaining(['MRI', 'EEG']));
        fireEvent.click(within(kinds).getByRole('button', { name: 'EEG' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(pending().filter((op) => op.type === 'create_entity')).toHaveLength(1);
        expect(last()).toMatchObject({
            type: 'create_entity',
            parent: 'study',
            list: 'acquisitions',
            entity: { acquisition_type: 'EEG' },
        });
    });

    it('the toolbar accepts the focused item, and opens reject on it', () => {
        const { state, last } = setup();
        act(() => state().focusSlot('slot:grp_a:species'));
        fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
        expect(last()).toMatchObject({
            type: 'verdict',
            verdict: 'accept',
            target: { kind: 'slot', entity: 'grp_a', path: 'species' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
        expect(screen.getByRole('group', { name: 'reject species' })).toBeInTheDocument();
    });
});

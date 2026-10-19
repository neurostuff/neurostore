import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Op } from '../contract/generated/review-ops';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { renderThroughServer, renderWithStores } from '../test/render';
import { fakeServer } from '../test/fakeServer';
import { reject } from '../inspector/actions';
import { ReviewScreen } from './ReviewScreen';

const TEXT = 'Twenty patients and twenty controls performed a Stroop task during a 3 T fMRI scan.';
const at = (word: string): [number, number] => [TEXT.indexOf(word), TEXT.indexOf(word) + word.length];

const review = {
    id: 'r1',
    user_id: 'u1',
    state: 'in_progress',
    last_seq: 0,
    provenance: {},
    annotations: {},
} as const;

const mixed = {
    local_id: 'a_1',
    name: ev('Patients > Controls', [at('patients')]),
    statistic: ev('t', [at('Stroop')]),
    definition: ev('patients minus controls'),
    outcome: ev('BOLD', [at('fMRI')], 'generated'),
    groups: [{ group: 'grp_a', n: ev(20, [at('Twenty')]) }],
};
const plain = { local_id: 'a_2', name: ev('Controls > Patients', [at('controls')]) };

const bundleOf = (analyses: object[]) =>
    makeBundle({ analyses, groups: [{ local_id: 'grp_a', name: ev('Patients', [at('patients')]) }] }, TEXT, {
        entities: entityRows(
            ...analyses.map((a) => row((a as { local_id: string }).local_id, 'Analysis', 'analyses')),
            row('grp_a', 'Group', 'groups')
        ),
        review: { ...review },
    });

function setup(analyses: object[] = [mixed, plain], focus = 'a_1') {
    const view = renderWithStores(<ReviewScreen />, bundleOf(analyses));
    act(() => view.stores.view.getState().setStep('analyses'));
    act(() => view.stores.view.getState().focusEntity(focus));
    const session = () => view.stores.session.getState();
    return { ...view, session };
}

const press = (key: string, init: KeyboardEventInit = {}, target: Element = document.body) =>
    act(() => void fireEvent.keyDown(target, { key, ...init }));

/** What the pending verdicts accept: a slot's path, or `entity` for the entity itself. */
const accepted = (ops: Op[]) =>
    ops
        .map((op) =>
            op.type === 'verdict' && op.verdict === 'accept'
                ? op.target.kind === 'entity'
                    ? `entity ${op.target.entity}`
                    : op.target.kind === 'slot'
                      ? op.target.path
                      : ''
                : ''
        )
        .sort();

type Judged = 'verified' | 'removed' | 'edited';

const judged = (provenance: Record<string, Judged>) =>
    Object.fromEntries(Object.entries(provenance).map(([key, state]) => [key, { state, user_id: 'u1', at: 'then' }]));

/** The card head of the entity `name`, found by its label. */
const headOf = (name: string) =>
    within(screen.getByRole('region', { name })).getByRole('group', { name: `${name}: card head` });
const statusIn = (name: string) => within(headOf(name)).getByRole('status');

describe('accepting a card', () => {
    it('accepts its fields and the entity at once when every unjudged field has evidence', () => {
        const { session } = setup([mixed, plain], 'a_2');
        press('A', { shiftKey: true });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(accepted(session().pending)).toEqual(['entity a_2', 'name']);
    });

    describe('when some unjudged fields have no evidence', () => {
        const dialog = () => screen.getByRole('dialog', { name: 'These fields don’t have evidence' });
        const choose = (name: string) => fireEvent.click(within(dialog()).getByRole('button', { name }));

        it('asks first, listing those fields by label, and sends nothing yet', () => {
            const { session } = setup();
            press('A', { shiftKey: true });
            expect(
                within(dialog())
                    .getAllByRole('listitem')
                    .map((li) => li.textContent)
            ).toEqual(['Definition', 'Outcome']);
            expect(
                within(dialog())
                    .getAllByRole('button')
                    .map((b) => b.textContent)
            ).toEqual(['Cancel', 'Accept fields with evidence', 'Accept all fields']);
            expect(session().pending).toEqual([]);
        });

        it('Cancel sends nothing', () => {
            const { session } = setup();
            press('A', { shiftKey: true });
            choose('Cancel');
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(session().pending).toEqual([]);
        });

        it('Accept fields with evidence accepts those and the entity, as one batch', () => {
            const { session } = setup();
            press('A', { shiftKey: true });
            choose('Accept fields with evidence');
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(accepted(session().pending)).toEqual(['entity a_1', 'groups[#0].n', 'name', 'statistic']);
            expect(new Set(Object.values(session().groupOf)).size).toBe(1);
        });

        it('Accept all fields accepts every unjudged field, with evidence or not, and the entity', () => {
            const { session } = setup();
            press('A', { shiftKey: true });
            choose('Accept all fields');
            expect(accepted(session().pending)).toEqual([
                'definition',
                'entity a_1',
                'groups[#0].n',
                'name',
                'outcome',
                'statistic',
            ]);
        });

        it('never changes a field already judged', () => {
            const { session, stores } = setup();
            act(() => void reject(stores, { kind: 'slot', entity: 'a_1', path: 'definition' }, 'wrong_value', ''));
            act(() => stores.view.getState().focusSlot('slot:a_1:name'));
            press('a');
            const before = session().pending.length;
            press('A', { shiftKey: true });
            expect(
                within(dialog())
                    .getAllByRole('listitem')
                    .map((li) => li.textContent)
            ).toEqual(['Outcome']);
            choose('Accept all fields');
            expect(accepted(session().pending.slice(before))).toEqual([
                'entity a_1',
                'groups[#0].n',
                'outcome',
                'statistic',
            ]);
        });

        it('starts on Accept fields with evidence; Escape cancels', () => {
            const { session } = setup();
            press('A', { shiftKey: true });
            expect(within(dialog()).getByRole('button', { name: 'Accept fields with evidence' })).toHaveFocus();
            press('Escape', {}, dialog());
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(session().pending).toEqual([]);
        });

        it('leaves Enter to the dialog: it does not run the shortcut Enter has', () => {
            const { stores, session } = setup();
            act(() => stores.view.getState().focusSlot('slot:a_1:name'));
            press('A', { shiftKey: true });
            press('Enter', {}, within(dialog()).getByRole('heading'));
            press('Enter', {}, dialog());
            expect(stores.view.getState().panel?.kind).not.toBe('edit');
            expect(dialog()).toBeInTheDocument();
            expect(session().pending).toEqual([]);
        });
    });

    describe('the card’s Accept button', () => {
        const card = (name: string) => screen.getByRole('region', { name });
        const acceptButton = (name: string) => within(card(name)).getByRole('button', { name: 'Accept analysis' });
        function setupJudged(provenance: Record<string, Judged>, analyses: object[] = [plain]) {
            const bundle = bundleOf(analyses);
            const view = renderWithStores(<ReviewScreen />, {
                ...bundle,
                review: { ...review, provenance: judged(provenance) },
            });
            act(() => view.stores.view.getState().setStep('analyses'));
            return view;
        }

        it('is named after the entity’s kind and keeps the key Shift+A', () => {
            setup([mixed, plain], 'a_2');
            expect(acceptButton('Controls > Patients')).toHaveAttribute('aria-keyshortcuts', 'Shift+A');
        });

        it('accepts a card whose fields are all judged, finishing the step', () => {
            const { stores } = setupJudged({ 'slot:a_2:name': 'removed' });
            expect(screen.getByRole('heading', { name: /^analyses ·/ })).toHaveTextContent('0 of 1 done');
            const button = acceptButton('Controls > Patients');
            expect(button).toBeEnabled();
            fireEvent.click(button);
            expect(accepted(stores.session.getState().pending)).toEqual(['entity a_2']);
            expect(screen.getByRole('heading', { name: /^analyses ·/ })).toHaveTextContent('1 of 1 done');
            expect(stores.session.getState().provenance['slot:a_2:name']?.state).toBe('removed');
        });

        it('is unavailable once the card and all its fields are judged, saying so', () => {
            setupJudged({ 'slot:a_2:name': 'verified', 'entity:a_2': 'verified' });
            const button = acceptButton('Controls > Patients');
            expect(button).toBeDisabled();
            expect(button).toHaveAttribute('title', 'This card and all its fields are judged');
        });

        it('accepts only the unjudged field with evidence on an entity already verified', () => {
            const { stores } = setupJudged({ 'entity:a_2': 'verified' });
            fireEvent.click(acceptButton('Controls > Patients'));
            expect(accepted(stores.session.getState().pending)).toEqual(['name']);
            expect(statusIn('Controls > Patients')).toHaveTextContent(/^Accepted 1 field$/);
        });

        it('stays available on an accepted card while fields without evidence are unjudged, asking first', () => {
            const { stores } = setupJudged(
                {
                    'entity:a_1': 'verified',
                    'slot:a_1:name': 'verified',
                    'slot:a_1:statistic': 'verified',
                    'slot:a_1:groups[#0].n': 'verified',
                },
                [mixed]
            );
            const button = acceptButton('Patients > Controls');
            expect(button).toBeEnabled();
            fireEvent.click(button);
            const dialog = screen.getByRole('dialog', { name: 'These fields don’t have evidence' });
            const withEvidence = within(dialog).getByRole('button', { name: 'Accept fields with evidence' });
            expect(withEvidence).toBeDisabled();
            expect(withEvidence).toHaveAccessibleDescription('No unjudged field on this card has evidence');
            fireEvent.click(within(dialog).getByRole('button', { name: 'Accept all fields' }));
            expect(accepted(stores.session.getState().pending)).toEqual(['definition', 'outcome']);
            expect(statusIn('Patients > Controls')).toHaveTextContent(/^Accepted 2 fields$/);
        });
    });

    it('is undone, fields and entity, by one undo', async () => {
        const server = fakeServer([{ ...bundleOf([mixed, plain]), review: null }]);
        const { stores, client } = await renderThroughServer(<ReviewScreen />, server, 'P1');
        const saved = () => waitFor(() => expect(stores.session.getState().pending).toEqual([]), { timeout: 10_000 });
        act(() => stores.view.getState().setStep('analyses'));
        act(() => stores.view.getState().focusEntity('a_1'));
        press('A', { shiftKey: true });
        fireEvent.click(screen.getByRole('button', { name: 'Accept all fields' }));
        await saved();
        expect(Object.keys(stores.session.getState().provenance)).toHaveLength(6);
        press('z', { ctrlKey: true });
        await saved();
        expect(stores.session.getState().provenance).toEqual({});
        client.stop();
    });

    describe('after it runs', () => {
        const head = headOf;
        const status = statusIn;

        it('says it accepted every field after Accept all fields, with nothing left', () => {
            setup();
            press('A', { shiftKey: true });
            fireEvent.click(screen.getByRole('button', { name: 'Accept all fields' }));
            expect(status('Patients > Controls')).toHaveTextContent(/^Accepted the analysis and 5 fields$/);
        });

        it('clears once the focus moves to another card', () => {
            const { stores } = setup([mixed, plain], 'a_2');
            press('A', { shiftKey: true });
            act(() => stores.view.getState().focusEntity('a_1'));
            act(() => stores.view.getState().focusEntity('a_2'));
            expect(status('Controls > Patients')).toHaveTextContent(/^$/);
        });

        it('says what it accepted and what it left, where a screen reader announces it', () => {
            setup();
            expect(status('Patients > Controls')).toHaveTextContent(/^$/);
            press('A', { shiftKey: true });
            fireEvent.click(screen.getByRole('button', { name: 'Accept fields with evidence' }));
            expect(status('Patients > Controls')).toHaveTextContent(
                'Accepted the analysis and 3 fields · 2 fields without evidence still unchecked'
            );
        });

        it('leaves out the count of fields without evidence when there are none', () => {
            setup([mixed, plain], 'a_2');
            press('A', { shiftKey: true });
            expect(status('Controls > Patients')).toHaveTextContent(/^Accepted the analysis and 1 field$/);
        });

        it('turns the card head’s status from unchecked to verified', () => {
            setup([mixed, plain], 'a_2');
            expect(within(head('Controls > Patients')).getByText('unchecked')).toBeInTheDocument();
            press('A', { shiftKey: true });
            expect(within(head('Controls > Patients')).queryByText('unchecked')).not.toBeInTheDocument();
            expect(within(head('Controls > Patients')).getByText(/^verified/)).toBeInTheDocument();
        });
    });

    describe('the way on', () => {
        it('offers the step’s next unchecked card while the step is not done, and focuses it', () => {
            const { stores } = setup([mixed, plain], 'a_1');
            press('A', { shiftKey: true });
            fireEvent.click(screen.getByRole('button', { name: 'Accept fields with evidence' }));
            expect(screen.queryByRole('button', { name: /^Next: / })).not.toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Next analysis' }));
            expect(stores.view.getState().focus.entity).toBe('a_2');
        });

        it('goes round to an earlier card that is still unchecked', () => {
            const { stores } = setup([mixed, plain], 'a_2');
            press('A', { shiftKey: true });
            fireEvent.click(screen.getByRole('button', { name: 'Next analysis' }));
            expect(stores.view.getState().focus.entity).toBe('a_1');
        });

        it('skips a hidden card, though the view shows it', () => {
            const hiddenOne = { local_id: 'a_h', name: ev('No coordinates') };
            const view = renderWithStores(<ReviewScreen />, {
                ...bundleOf([mixed, plain, hiddenOne]),
                hidden: { analyses: ['a_h'], entities: [] },
            });
            const viewState = () => view.stores.view.getState();
            act(() => viewState().setStep('analyses'));
            act(() => viewState().toggleNonCoordinate());
            act(() => viewState().focusEntity('a_2'));
            expect(
                within(screen.getByRole('list', { name: 'analyses' })).getByText('No coordinates')
            ).toBeInTheDocument();
            press('A', { shiftKey: true });
            fireEvent.click(screen.getByRole('button', { name: 'Next analysis' }));
            expect(viewState().focus.entity).toBe('a_1');
        });

        it('leaves the way on to the step guide’s next step once the step is done', () => {
            setup([plain], 'a_2');
            press('A', { shiftKey: true });
            expect(screen.getByRole('button', { name: 'Next: Entities →' })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Next analysis' })).not.toBeInTheDocument();
        });
    });

    describe('which fields it takes', () => {
        const gaps = {
            local_id: 'a_3',
            name: ev('Siblings > Controls', [at('controls')]),
            spatial_scope: {
                extraction_status: 'not_reported',
                unreported_reason: 'outside_text',
                evidence: { status: 'not_applicable' },
            },
            definition: ev('siblings minus controls'),
        };

        function setupGaps() {
            const bundle = bundleOf([gaps]);
            const view = renderWithStores(<ReviewScreen />, {
                ...bundle,
                review: { ...review, provenance: judged({ 'slot:a_3:definition': 'edited' }) },
            });
            act(() => view.stores.view.getState().setStep('analyses'));
            return view;
        }

        it('lists a not-reported field and takes it with Accept all fields; never an edited one, nor one the record leaves out', () => {
            const { stores } = setupGaps();
            press('A', { shiftKey: true });
            const dialog = screen.getByRole('dialog', { name: 'These fields don’t have evidence' });
            expect(
                within(dialog)
                    .getAllByRole('listitem')
                    .map((li) => li.textContent)
            ).toEqual(['Spatial scope']);
            fireEvent.click(within(dialog).getByRole('button', { name: 'Accept all fields' }));
            expect(accepted(stores.session.getState().pending)).toEqual(['entity a_3', 'name', 'spatial_scope']);
            expect(stores.session.getState().index.slot('slot:a_3:statistic')?.value).toBeUndefined();
            expect(stores.session.getState().provenance['slot:a_3:definition']?.state).toBe('edited');
        });
    });
});

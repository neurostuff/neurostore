import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import type { Op } from '../contract/generated/review-ops';
import type { ReviewBundle } from '../contract/generated/review-bundle';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { CUNEUS, coordinateBundle, HOUSES, key, REVIEW } from '../test/coordinates';
import type { CoordinateAnalysis } from '../model/coordinates';
import { renderWithStores } from '../test/render';
import type { OpClient } from '../store/opClient';
import { OpClientProvider } from '../store/context';
import { ReviewScreen } from './ReviewScreen';
import { SubmitStep } from './SubmitStep';

const review = { id: 'r1', user_id: 'me', state: 'in_progress' as const, last_seq: 0, provenance: {}, annotations: {} };
const edit = {
    client_op_id: 'op-1',
    type: 'set_evidence' as const,
    target: { kind: 'slot' as const, entity: 'study', path: 'description' },
    evidence: { status: 'not_found' as const },
};

describe('the submit step', () => {
    it('is disabled while anything is unsaved, and enabled once everything is saved', () => {
        const client = { changeState: vi.fn(async () => {}) } as unknown as OpClient;
        const { stores } = renderWithStores(
            <OpClientProvider client={client}>
                <SubmitStep />
            </OpClientProvider>,
            makeBundle({}, 'text', { review })
        );
        const submit = screen.getByRole('button', { name: 'Submit review' });
        expect(submit).toBeEnabled();
        act(() => stores.session.setState({ pending: [edit] }));
        expect(submit).toBeDisabled();
        act(() => stores.session.setState({ pending: [] }));
        expect(submit).toBeEnabled();
        fireEvent.click(submit);
        expect(client.changeState).toHaveBeenCalledWith('submitted');
    });
});

describe('submitting', () => {
    const TEXT = 'x'.repeat(100);
    const clientStub = () => ({ changeState: vi.fn(async () => {}) }) as unknown as OpClient;

    function screenOn(bundle: ReviewBundle, client: OpClient) {
        const view = renderWithStores(
            <OpClientProvider client={client}>
                <ReviewScreen />
            </OpClientProvider>,
            bundle
        );
        act(() => view.stores.view.getState().setStep('submit'));
        return view;
    }

    it('skips the confirmation when nothing is left unreviewed', () => {
        const client = clientStub();
        screenOn(makeBundle({}, TEXT, { review }), client);
        expect(screen.queryByText(/still unreviewed/)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Submit review' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(client.changeState).toHaveBeenCalledWith('submitted');
    });

    it('leaves the Enter key to the confirmation: it neither runs the shortcut Enter has nor submits', () => {
        const client = clientStub();
        const { stores } = screenOn(
            makeBundle({ groups: [{ local_id: 'grp_a', name: ev('Patients') }] }, TEXT, {
                review,
                entities: entityRows(row('grp_a', 'Group', 'groups')),
            }),
            client
        );
        act(() => stores.view.getState().focusSlot('slot:grp_a:name'));
        fireEvent.click(screen.getByRole('button', { name: 'Submit review' }));
        const dialog = screen.getByRole('dialog', { name: /unreviewed\?$/ });
        fireEvent.keyDown(within(dialog).getByRole('heading'), { key: 'Enter' });
        fireEvent.keyDown(dialog, { key: 'Enter' });
        expect(stores.view.getState().panel).toBeNull();
        expect(client.changeState).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog', { name: /unreviewed\?$/ })).toBeInTheDocument();
    });
});

describe('the submit summary', () => {
    const TEXT = 'x'.repeat(100);
    const original = {
        groups: [
            { local_id: 'grp_a', name: ev('Patients') },
            { local_id: 'grp_b', name: ev('Controls') },
            { local_id: 'grp_c', name: ev('Siblings') },
        ],
        analyses: [{ local_id: 'a_1', name: ev('Patients > Controls'), groups: [{ group: 'grp_a', n: ev(20) }] }],
    };
    const originalRows = entityRows(
        row('grp_a', 'Group', 'groups'),
        row('grp_b', 'Group', 'groups'),
        row('grp_c', 'Group', 'groups'),
        row('a_1', 'Analysis', 'analyses')
    );
    const rows = originalRows.filter((r) => r.local_id !== 'grp_c');
    const stored = (seq: number, op: object) => ({
        seq,
        op: op as Op,
        before: {},
        after: {},
        user_id: 'me',
        created_at: 'then',
    });
    const ops = [
        stored(1, {
            client_op_id: 'n-1',
            type: 'note',
            target: { kind: 'entity', entity: 'grp_a' },
            note: 'check the ages',
        }),
        stored(2, {
            client_op_id: 'v-1',
            type: 'verdict',
            verdict: 'accept',
            target: { kind: 'slot', entity: 'grp_b', path: 'name' },
            note: 'renamed as in table 1',
        }),
    ];

    function setup(strict = false) {
        const record = {
            groups: [
                { local_id: 'grp_a', name: ev('Patients') },
                { local_id: 'grp_b', name: ev('Healthy controls') },
            ],
            analyses: original.analyses,
        };
        const verified = { state: 'verified' as const, user_id: 'me', at: 'then' };
        const client = { changeState: vi.fn(async () => {}) } as unknown as OpClient;
        const step = (
            <OpClientProvider client={client}>
                <SubmitStep />
            </OpClientProvider>
        );
        const view = renderWithStores(
            strict ? <StrictMode>{step}</StrictMode> : step,
            makeBundle(record, TEXT, {
                entities: rows,
                ops,
                review: { ...review, last_seq: 2, provenance: { 'entity:a_1': verified, 'slot:grp_b:name': verified } },
                original: {
                    record: { local_id: 'P1', ...original },
                    coordinate_revision: null,
                    entities: originalRows,
                    hidden: { analyses: [], entities: [] },
                },
            })
        );
        return { ...view, client };
    }

    const section = (name: string) => screen.getByRole('region', { name });

    it('counts what changed by kind, each item focusing what it names', () => {
        const { stores } = setup();
        const changes = section('what changed');
        expect(within(changes).getByRole('heading', { name: 'slots edited (1)' })).toBeInTheDocument();
        expect(within(changes).getByRole('heading', { name: 'entities removed (1)' })).toBeInTheDocument();
        expect(within(changes).getByText('Siblings')).toBeInTheDocument();
        expect(within(changes).queryByRole('button', { name: 'Siblings' })).not.toBeInTheDocument();
        expect(within(changes).queryByRole('heading', { name: /links added/ })).not.toBeInTheDocument();
        fireEvent.click(within(changes).getByRole('button', { name: 'Healthy controls · Name' }));
        expect(stores.view.getState().focus.key).toBe('slot:grp_b:name');
    });

    it('lists the open notes from the op log, each focusing its item', () => {
        const { stores } = setup();
        const notes = section('open notes');
        expect(within(notes).getByRole('heading', { name: 'open notes (2)' })).toBeInTheDocument();
        fireEvent.click(within(notes).getByRole('button', { name: /Patients.*check the ages/ }));
        expect(stores.view.getState().focus.key).toBe('entity:grp_a');
        expect(
            within(notes).getByRole('button', { name: /Healthy controls · Name.*renamed as in table 1/ })
        ).toBeInTheDocument();
    });

    it('lists the unreviewed items by step, says how many, and still lets the review be submitted, after confirming', () => {
        const { stores, client } = setup();
        const unreviewed = section('unreviewed');
        expect(within(unreviewed).getByRole('heading', { name: 'unreviewed (2)' })).toBeInTheDocument();
        expect(within(unreviewed).getByRole('heading', { name: 'Entities (1)' })).toBeInTheDocument();
        expect(within(unreviewed).getByRole('heading', { name: 'Leftovers (1)' })).toBeInTheDocument();
        expect(within(unreviewed).queryByRole('heading', { name: /Analyses|Relationships/ })).not.toBeInTheDocument();
        fireEvent.click(within(unreviewed).getByRole('button', { name: 'Patients' }));
        expect(stores.view.getState().focus.key).toBe('entity:grp_a');
        expect(screen.getByText('2 items are still unreviewed.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Submit review' }));
        expect(client.changeState).not.toHaveBeenCalled();
        const dialog = screen.getByRole('dialog', { name: 'Submit with 2 items unreviewed?' });
        expect(within(dialog).getByRole('list', { name: 'still unreviewed' })).toHaveTextContent('Entities: 1');
        expect(within(dialog).getByRole('list', { name: 'still unreviewed' })).toHaveTextContent('Leftovers: 1');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Submit anyway' }));
        expect(client.changeState).toHaveBeenCalledWith('submitted');
    });

    it('starts the confirmation on Review them under StrictMode too', () => {
        setup(true);
        const submit = screen.getByRole('button', { name: 'Submit review' });
        act(() => submit.focus());
        fireEvent.click(submit);
        const dialog = screen.getByRole('dialog', { name: 'Submit with 2 items unreviewed?' });
        expect(within(dialog).getByRole('button', { name: 'Review them' })).toHaveFocus();
    });

    it('goes to the first item left to review from the confirmation, its default, submitting nothing (H1)', () => {
        const { stores, client } = setup();
        fireEvent.click(screen.getByRole('button', { name: 'Submit review' }));
        const dialog = screen.getByRole('dialog', { name: 'Submit with 2 items unreviewed?' });
        const reviewThem = within(dialog).getByRole('button', { name: 'Review them' });
        expect(reviewThem).toHaveFocus();
        fireEvent.click(reviewThem);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(stores.view.getState().step).toBe('entities');
        expect(client.changeState).not.toHaveBeenCalled();
    });

    it('says the review is done once submitted, and what is next (H2)', () => {
        const { stores } = setup();
        act(() => stores.session.getState().setLifecycle('submitted'));
        const done = screen.getByRole('status', { name: 'review submitted' });
        expect(done).toHaveTextContent('Review submitted');
        expect(within(done).getByRole('link', { name: 'Back to the papers' })).toHaveAttribute('href', '/');
    });
});

describe('the submit summary by kind', () => {
    const removed = { state: 'removed' as const, user_id: 'me', at: 'then' };

    const original = {
        groups: [
            { local_id: 'grp_a', name: ev('Patients'), n: ev(20) },
            { local_id: 'grp_b', name: ev('Controls'), n: ev(18) },
            { local_id: 'grp_c', name: ev('Siblings') },
        ],
        analyses: [{ local_id: 'a_1', name: ev('Patients > Controls'), groups: [{ group: 'grp_a' }] }],
    };
    const originalRows = entityRows(
        row('grp_a', 'Group', 'groups'),
        row('grp_b', 'Group', 'groups'),
        row('grp_c', 'Group', 'groups'),
        row('a_1', 'Analysis', 'analyses')
    );

    const named = (n: number, name: string, extra: Partial<CoordinateAnalysis> = {}): CoordinateAnalysis => ({
        ...HOUSES,
        key: key(n),
        name,
        points: [CUNEUS],
        ...extra,
    });
    const [A1, A2, A3, A4, A5, A6, A7, A8] = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => named(n, `Contrast ${n}`));
    const s1 = { ...A1, key: key(0x11), name: 'Contrast 1a', derived_from: [A1.key] };
    const s2 = { ...A1, key: key(0x12), name: 'Contrast 1b', derived_from: [A1.key] };
    const merged = { ...A2, key: key(0x13), name: 'Contrast 2+3', derived_from: [A2.key, A3.key] };
    const relabelled = { ...A4, role: 'anchor' };
    const resized = { ...A5, points: [{ ...CUNEUS, cluster_size: 99 }] };
    const addedAnalysis = named(0x14, 'Reviewer contrast', { derived_from: undefined });
    const verdict = (a: CoordinateAnalysis, kind: string, replaced_by?: string[]) => ({
        key: a.key,
        verdict: kind,
        reason: 'x',
        ...(replaced_by && { replaced_by }),
    });

    function setup({
        provenance = {},
        showNonCoordinate = false,
        overrides = {},
        analysesRevised = true,
        edit = () => {},
    }: {
        provenance?: Record<string, typeof removed>;
        showNonCoordinate?: boolean;
        overrides?: Partial<ReviewBundle>;
        analysesRevised?: boolean;
        edit?: (record: { groups: Record<string, unknown>[] }) => void;
    } = {}) {
        const record = structuredClone(original) as typeof original & { groups: Record<string, unknown>[] };
        record.groups[0].n = ev(24);
        record.groups[1].n = ev(19);
        record.groups.push({ local_id: 'grp_d', name: ev('Relatives') });
        record.groups.splice(2, 1);
        (record.analyses[0].groups[0] as { group: string }).group = 'grp_b';
        edit(record);
        const rows = [...originalRows.filter((r) => r.local_id !== 'grp_c'), row('grp_d', 'Group', 'groups')];
        const parse = { analyses: [A1, A2, A3, A4, A5, A6, A7, A8] };
        const revision = {
            ...parse,
            revision_of: 'parse-1',
            analyses: [s1, s2, merged, relabelled, resized, A7, A8, addedAnalysis],
            verdicts: [
                verdict(A1, 'split', [s1.key, s2.key]),
                verdict(A2, 'merge', [merged.key]),
                verdict(A3, 'merge', [merged.key]),
                verdict(A4, 'relabel'),
                verdict(A5, 'edit'),
                verdict(A6, 'omit'),
                verdict(A7, 'accept'),
                verdict(A8, 'accept'),
                verdict(addedAnalysis, 'add'),
            ],
        };
        const client = { changeState: vi.fn(async () => {}) } as unknown as OpClient;
        const view = renderWithStores(
            <OpClientProvider client={client}>
                <SubmitStep />
            </OpClientProvider>,
            coordinateBundle({
                record: { local_id: 'P1', ...record },
                entities: rows,
                coordinate_parse: parse as ReviewBundle['coordinate_parse'],
                coordinate_revision: (analysesRevised ? revision : null) as ReviewBundle['coordinate_revision'],
                review: { ...REVIEW, provenance },
                original: {
                    record: { local_id: 'P1', ...original },
                    coordinate_revision: null,
                    entities: originalRows,
                    hidden: { analyses: [], entities: [] },
                },
                ...overrides,
            })
        );
        if (showNonCoordinate) act(() => view.stores.view.getState().toggleNonCoordinate());
        return view;
    }

    const groupsOf = (name: string) =>
        within(screen.getByRole('region', { name }))
            .getAllByRole('heading', { level: 4 })
            .map((h) => [h.textContent, [...h.nextElementSibling!.querySelectorAll('li')].map((li) => li.textContent)]);

    it('counts every kind of change and lists what each names, the analyses by their names', () => {
        setup({ provenance: { [`coordinate_analysis:${A7.key}`]: removed } });
        expect(groupsOf('what changed')).toEqual([
            ['slots edited (2)', ['Patients · n', 'Controls · n']],
            ['entities added (1)', ['Relatives']],
            ['entities removed (1)', ['Siblings']],
            ['links added (1)', ['Patients > Controls · Group 1: group → Controls']],
            ['links removed (1)', ['Patients > Controls · Group 1: group → Patients']],
            ['coordinate analyses split (1)', ['Contrast 1']],
            ['coordinate analyses merged (2)', ['Contrast 2', 'Contrast 3']],
            ['coordinate analyses edited (2)', ['Contrast 4', 'Contrast 5']],
            ['coordinate analyses rejected (2)', ['Contrast 6', 'Contrast 7']],
            ['coordinate analyses added (1)', ['Reviewer contrast']],
        ]);
        expect(screen.getByRole('heading', { name: 'what changed (14)' })).toBeInTheDocument();
    });

    it('counts under rejected the slot, entity and link the reviewer rejected, though the record still holds them', () => {
        setup({
            analysesRevised: false,
            provenance: {
                'slot:grp_a:name': removed,
                'entity:grp_b': removed,
                'relationship:a_1:groups[#0].group:grp_b': removed,
            },
        });
        const groups = groupsOf('what changed');
        expect(groups).toContainEqual([
            'rejected (3)',
            ['Patients · Name', 'Controls', 'Patients > Controls · Group 1: group → Controls'],
        ]);
        expect(groups).toContainEqual(['slots edited (2)', ['Patients · n', 'Controls · n']]);
        expect(groups.map(([heading]) => heading)).not.toContain('links added (1)');
    });

    it('focuses the entity of a slot removed from a kept entity, and the slot of a removed link', () => {
        const { stores } = setup({ analysesRevised: false, edit: (record) => delete record.groups[1].n });
        const changes = screen.getByRole('region', { name: 'what changed' });
        fireEvent.click(within(changes).getByRole('button', { name: 'Controls · n' }));
        expect(stores.view.getState().focus.key).toBe('entity:grp_b');
        fireEvent.click(
            within(changes).getByRole('button', { name: 'Patients > Controls · Group 1: group → Patients' })
        );
        expect(stores.view.getState().focus.key).toBe('slot:a_1:groups[#0].group');
        expect(within(changes).queryByRole('button', { name: 'Siblings' })).not.toBeInTheDocument();
    });

    it('leaves out the changes of hidden entities until the non-coordinate items are shown', () => {
        const hidden = { analyses: ['a_1'], entities: [] };
        setup({ analysesRevised: false, overrides: { hidden } });
        expect(groupsOf('what changed').map(([heading]) => heading)).not.toContain('links added (1)');
        expect(screen.getByRole('heading', { name: 'what changed (4)' })).toBeInTheDocument();
        cleanup();
        setup({ analysesRevised: false, overrides: { hidden }, showNonCoordinate: true });
        expect(groupsOf('what changed').map(([heading]) => heading)).toContain('links added (1)');
        expect(screen.getByRole('heading', { name: 'what changed (6)' })).toBeInTheDocument();
    });

    it('lists the notes still waiting to be saved among the open notes', () => {
        const { stores } = setup({ analysesRevised: false });
        act(() =>
            stores.session.setState({
                pending: [
                    { client_op_id: 'n-9', type: 'note', target: { kind: 'entity', entity: 'grp_a' }, note: 'later' },
                ],
            })
        );
        expect(screen.getByRole('heading', { name: 'open notes (1)' })).toBeInTheDocument();
        expect(within(screen.getByRole('region', { name: 'open notes' })).getByText('later')).toBeInTheDocument();
    });
});

import { act, fireEvent, screen, within } from '@testing-library/react';
import type { AnyTarget, Op } from '../contract/generated/review-ops';
import { withoutIds } from '../test/undoHelpers';
import { entityRows, ev, hasFixture, loadFixture, makeBundle, row } from '../test/bundles';
import { renderWithStore } from '../test/render';
import { RelationshipAudit } from './RelationshipAudit';
import { ReviewScreen } from './ReviewScreen';

const TEXT = 'Twenty patients and twenty controls performed a Stroop task during a 3 T fMRI scan.';
const at = (word: string): [number, number] => [TEXT.indexOf(word), TEXT.indexOf(word) + word.length];

const record = {
    analyses: [
        {
            local_id: 'a_1',
            name: ev('Patients > Controls', [at('patients')]),
            statistic: ev('t', [at('Stroop')]),
            acquisitions: ['acq_1'],
            groups: [{ group: 'grp_a', n: ev(20, [at('Twenty')]) }],
        },
        { local_id: 'a_h', name: ev('No coordinates') },
        { local_id: 'a_2', name: ev('Controls > Patients', [at('controls')]), acquisitions: ['acq_1'] },
    ],
    groups: [
        { local_id: 'grp_a', name: ev('Patients', [at('patients')]) },
        { local_id: 'grp_b', name: ev('Controls', [at('controls')]) },
        { local_id: 'grp_c', name: ev('Patients again', [at('Twenty')]) },
    ],
    acquisitions: [{ local_id: 'acq_1', name: ev('fMRI', [at('fMRI')]) }],
};

const entities = entityRows(
    row('a_1', 'Analysis', 'analyses'),
    row('a_h', 'Analysis', 'analyses'),
    row('a_2', 'Analysis', 'analyses'),
    row('grp_a', 'Group', 'groups'),
    row('grp_b', 'Group', 'groups'),
    row('grp_c', 'Group', 'groups'),
    row('acq_1', 'Acquisition', 'acquisitions')
);

const bundle = makeBundle(record, TEXT, { entities, hidden: { analyses: ['a_h'], entities: [] } });

const press = (key: string, init: KeyboardEventInit = {}) =>
    act(() => void fireEvent.keyDown(document.body, { key, ...init }));

function setup(step: 'analyses' | 'entities' | 'leftovers' | 'relationships') {
    const view = renderWithStore(<ReviewScreen />, bundle);
    act(() => view.store.getState().setStep(step));
    return view;
}

const cardList = (name: string) => screen.getByRole('list', { name });
const cardNames = (name: string) =>
    within(cardList(name))
        .getAllByRole('button', { name: /./ })
        .filter((b) => b.hasAttribute('data-card'))
        .map((b) => b.getAttribute('data-card'));

describe('step 2, analyses', () => {
    it('shows one card per analysis in record order, leaving out hidden ones until shown, then last', () => {
        const { store } = setup('analyses');
        expect(cardNames('analyses')).toEqual(['a_1', 'a_2']);
        act(() => store.getState().toggleNonCoordinate());
        expect(cardNames('analyses')).toEqual(['a_1', 'a_2', 'a_h']);
    });

    it('opens on the first analysis, with its name, slots and evidence, through the inspector’s card', () => {
        const { store } = setup('analyses');
        expect(store.getState().focus.entity).toBe('a_1');
        const card = screen.getByRole('region', { name: 'Patients > Controls' });
        expect(within(card).getByText('statistic')).toBeInTheDocument();
        expect(within(card).getByText('groups[#0].n')).toBeInTheDocument();
        expect(within(cardList('analyses')).getByRole('button', { name: /Patients > Controls/ })).toHaveTextContent(
            '3 evidence spans'
        );
        expect(store.getState().focusedSpans).toEqual([at('Twenty'), at('patients'), at('Stroop')]);
    });

    it('Shift+J and Shift+K move between the step’s cards; J and K between the slots of one', () => {
        const { store } = setup('analyses');
        press('J', { shiftKey: true });
        expect(store.getState().focus.entity).toBe('a_2');
        press('J', { shiftKey: true });
        expect(store.getState().focus.entity).toBe('a_2');
        press('K', { shiftKey: true });
        expect(store.getState().focus.entity).toBe('a_1');
        press('j');
        expect(store.getState().focus.entity).toBe('a_1');
        expect(store.getState().focus.slot).toBeDefined();
    });

    it('accepts and rejects on the card as the inspector does, and shows a judged card as done', () => {
        const { store } = setup('analyses');
        const card = () => within(cardList('analyses')).getByRole('button', { name: /Patients > Controls/ });
        expect(card()).not.toHaveTextContent('done');
        press('a');
        expect(store.getState().provenance['entity:a_1']?.state).toBe('verified');
        expect(card()).toHaveTextContent('done');
        press('J', { shiftKey: true });
        press('r');
        expect(screen.getByRole('group', { name: 'reject Controls > Patients' })).toBeInTheDocument();
    });

    it('focuses an analysis when its card is clicked', () => {
        const { store } = setup('analyses');
        fireEvent.click(within(cardList('analyses')).getByRole('button', { name: /Controls > Patients/ }));
        expect(store.getState().focus.entity).toBe('a_2');
    });
});

describe('step 3, entities outward from the analyses', () => {
    it('lists the entities the analyses use once each, most used first, and opens on the first', () => {
        const { store } = setup('entities');
        expect(cardNames('entities')).toEqual(['acq_1', 'grp_a']);
        expect(store.getState().focus.entity).toBe('acq_1');
    });

    it('names the reviewer who checked each link', () => {
        const { store } = setup('entities');
        act(() =>
            store.setState({
                bundle: { ...store.getState().bundle, reviewers: [{ user_id: 'u1', name: 'Ana', state: 'in_progress', op_count: 0, last_edit_at: null }] },
                provenance: { 'relationship:a_1:acquisitions:acq_1': { state: 'verified', user_id: 'u1', at: 'then' } },
            })
        );
        const links = screen.getByRole('list', { name: 'linked from' });
        expect(within(links).getAllByRole('listitem')[0]).toHaveTextContent('verified by Ana');
    });

    it('shows the analyses linked to the focused entity, so the links are checked there', () => {
        const { store } = setup('entities');
        const links = screen.getByRole('list', { name: 'linked from' });
        expect(
            within(links)
                .getAllByRole('listitem')
                .map((li) => li.firstChild?.textContent)
        ).toEqual(['Patients > Controls · acquisitions', 'Controls > Patients · acquisitions']);
        fireEvent.click(within(links).getAllByRole('button', { name: 'Accept link' })[0]);
        expect(store.getState().provenance['relationship:a_1:acquisitions:acq_1']?.state).toBe('verified');
        expect(within(links).getAllByRole('listitem')[0]).toHaveTextContent('verified');
        fireEvent.click(within(links).getAllByRole('button', { name: 'Unlink' })[1]);
        expect(store.getState().pending.at(-1)).toMatchObject({
            type: 'unlink',
            target: { kind: 'relationship', entity: 'a_2', path: 'acquisitions', target_entity: 'acq_1' },
        });
    });

    it('shows an entity already judged as done', () => {
        const judged = makeBundle(record, TEXT, {
            entities,
            hidden: bundle.hidden,
            review: {
                id: 'r1',
                user_id: 'u1',
                state: 'in_progress',
                last_seq: 0,
                provenance: { 'entity:grp_a': { state: 'verified', user_id: 'u1', at: '' } },
                annotations: {},
            },
        });
        const view = renderWithStore(<ReviewScreen />, judged);
        act(() => view.store.getState().setStep('entities'));
        const card = (name: RegExp) => within(cardList('entities')).getByRole('button', { name });
        expect(card(/^Patients/)).toHaveTextContent('done');
        expect(card(/^fMRI/)).not.toHaveTextContent('done');
    });
});

// jsdom renders MUI about ten times slower than a browser; the first click also warms React up, so is not timed.
const CLICK_BUDGET_MS = 100;

describe('step 5, the relationship audit', () => {
    const matrix = () => screen.getByRole('table', { name: 'relationship audit' });
    const cell = (name: string) => within(matrix()).getByRole('button', { name });

    it('has a row per analysis and a column group per class the analyses link to, marking each link', () => {
        setup('relationships');
        const headers = within(matrix())
            .getAllByRole('columnheader')
            .map((h) => h.textContent);
        expect(headers).toEqual(expect.arrayContaining(['Acquisition', 'Group', 'fMRI', 'Patients', 'Controls']));
        const rows = within(matrix())
            .getAllByRole('rowheader')
            .map((h) => h.textContent);
        expect(rows).toEqual(['Patients > Controls', 'Controls > Patients']);
        expect(cell('Patients > Controls → fMRI')).toHaveAttribute('aria-pressed', 'true');
        expect(cell('Patients > Controls → Patients')).toHaveAttribute('aria-pressed', 'true');
        expect(cell('Patients > Controls → Controls')).toHaveAttribute('aria-pressed', 'false');
    });

    it('toggles a link with a click: unlink where it is set, link where it is not', () => {
        const { store } = setup('relationships');
        fireEvent.click(cell('Controls > Patients → fMRI'));
        expect(store.getState().pending.at(-1)).toMatchObject({
            type: 'unlink',
            target: { entity: 'a_2', path: 'acquisitions', target_entity: 'acq_1' },
        });
        fireEvent.click(cell('Patients > Controls → Controls'));
        expect(store.getState().pending.at(-1)).toMatchObject({
            type: 'link',
            target: { entity: 'a_1', path: 'groups[#0].group', target_entity: 'grp_b' },
        });
    });

    it('cannot link where the analysis has no slot for it', () => {
        setup('relationships');
        expect(cell('Controls > Patients → Patients')).toBeDisabled();
    });

    it.skipIf(!hasFixture('25Czf8TcaxDS'))(
        `renders the largest paper and redraws after a click within ${CLICK_BUDGET_MS} ms`,
        () => {
            const view = renderWithStore(<RelationshipAudit />, loadFixture('25Czf8TcaxDS'));
            const analyses = view.store.getState().index.visible.filter((e) => e.entityClass === 'Analysis');
            const table = view.container.querySelector('table[aria-label="relationship audit"]')!;
            expect(table.querySelectorAll('tbody th')).toHaveLength(analyses.length);
            const [first, second] = table.querySelectorAll<HTMLButtonElement>('tbody button:not([disabled])');
            act(() => void fireEvent.click(first));
            const started = performance.now();
            act(() => void fireEvent.click(second));
            expect(performance.now() - started).toBeLessThan(CLICK_BUDGET_MS);
        },
        30_000
    );
});

describe('step 4, leftover entities', () => {
    const actions = () => screen.getByRole('toolbar', { name: 'leftover actions' });

    it('lists the entities no analysis reaches', () => {
        const { store } = setup('leftovers');
        expect(cardNames('leftovers')).toEqual(['grp_b', 'grp_c']);
        expect(store.getState().focus.entity).toBe('grp_b');
    });

    it('keeps one with an accept', () => {
        const { store } = setup('leftovers');
        fireEvent.click(within(actions()).getByRole('button', { name: 'Keep' }));
        expect(store.getState().provenance['entity:grp_b']?.state).toBe('verified');
    });

    it('links one to an analysis with the link action', async () => {
        const { store } = setup('leftovers');
        fireEvent.click(within(actions()).getByRole('button', { name: 'Link to an analysis' }));
        fireEvent.click(await screen.findByRole('option', { name: 'Patients > Controls · groups[#0].group' }));
        expect(store.getState().pending.at(-1)).toMatchObject({
            type: 'link',
            target: { entity: 'a_1', path: 'groups[#0].group', target_entity: 'grp_b' },
        });
    });

    it('merges one into another of its class, copying the slots chosen, as one batch', () => {
        const { store } = setup('leftovers');
        act(() => store.getState().focusEntity('grp_c'));
        fireEvent.click(within(actions()).getByRole('button', { name: 'Merge into…' }));
        const dialog = screen.getByRole('dialog', { name: 'Merge Patients again into…' });
        fireEvent.click(within(dialog).getByRole('radio', { name: 'Patients' }));
        fireEvent.click(within(dialog).getByRole('button', { name: 'Merge' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        const { pending, groupOf } = store.getState();
        expect(pending.map((op) => op.type)).toEqual(['delete_entity']);
        expect(new Set(pending.map((op) => groupOf[op.client_op_id] ?? op.client_op_id)).size).toBe(1);
    });

    it('deletes one with the delete dialog', () => {
        const { store } = setup('leftovers');
        fireEvent.click(within(actions()).getByRole('button', { name: 'Delete' }));
        const dialog = screen.getByRole('dialog', { name: 'Delete Controls?' });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
        expect(store.getState().pending.at(-1)).toMatchObject({ type: 'delete_entity', target: { entity: 'grp_b' } });
    });
});

describe('moving between steps', () => {
    const stepKey = (letter: 'J' | 'K') =>
        act(
            () =>
                void fireEvent.keyDown(document.body, {
                    key: letter,
                    code: `Key${letter}`,
                    altKey: true,
                    shiftKey: true,
                })
        );

    it('Alt+Shift+J and Alt+Shift+K go to the next and previous step, whatever character the layout types', () => {
        const { store } = renderWithStore(<ReviewScreen />, bundle);
        stepKey('J');
        expect(store.getState().step).toBe('analyses');
        expect(store.getState().focus.entity).toBe('a_1');
        act(() => void fireEvent.keyDown(document.body, { key: 'Ô', code: 'KeyJ', altKey: true, shiftKey: true }));
        expect(store.getState().step).toBe('entities');
        stepKey('K');
        expect(store.getState().step).toBe('analyses');
        stepKey('K');
        stepKey('K');
        expect(store.getState().step).toBe('coordinates');
    });

    it('does not change step on Alt+J without Shift', () => {
        const { store } = renderWithStore(<ReviewScreen />, bundle);
        act(() => void fireEvent.keyDown(document.body, { key: 'j', code: 'KeyJ', altKey: true }));
        expect(store.getState().step).toBe('coordinates');
    });

    it('lists the step keys in the help', () => {
        renderWithStore(<ReviewScreen />, bundle);
        press('?', { shiftKey: true });
        const help = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
        expect(help).toHaveTextContent('Alt+Shift+J');
        expect(help).toHaveTextContent('Alt+Shift+K');
    });

    it('shows each step’s done count in the step bar', () => {
        const { store } = setup('analyses');
        const stepButton = (name: RegExp) => screen.getByRole('button', { name });
        expect(stepButton(/^Analyses/)).toHaveTextContent('0 of 2');
        expect(stepButton(/^Entities/)).toHaveTextContent('0 of 2');
        expect(stepButton(/^Leftovers/)).toHaveTextContent('0 of 2');
        expect(stepButton(/^Relationships/)).toHaveTextContent('0 of 3');
        press('a');
        expect(stepButton(/^Analyses/)).toHaveTextContent('1 of 2');
        expect(store.getState().step).toBe('analyses');
    });

    it('keeps the reviewer’s step when the bundle is rebased', () => {
        const { store } = setup('leftovers');
        act(() => store.getState().rebase(bundle));
        expect(store.getState().step).toBe('leftovers');
    });
});

const pending = (store: { getState(): { pending: { client_op_id: string }[] } }) =>
    withoutIds(store.getState().pending as Op[]);

describe('the order of the entity cards', () => {
    const orderRecord = {
        analyses: [
            {
                local_id: 'a_1',
                name: ev('First'),
                groups: [
                    { group: 'grp_z', n: ev(1) },
                    { group: 'grp_a', n: ev(2) },
                ],
                acquisitions: ['acq_1'],
            },
        ],
        groups: [
            { local_id: 'grp_z', name: ev('Zeta group') },
            { local_id: 'grp_a', name: ev('Alpha group') },
        ],
        acquisitions: [{ local_id: 'acq_1', name: ev('Zzz scan') }],
    };
    const orderBundle = makeBundle(orderRecord, TEXT, {
        entities: entityRows(
            row('a_1', 'Analysis', 'analyses'),
            row('grp_z', 'Group', 'groups'),
            row('grp_a', 'Group', 'groups'),
            row('acq_1', 'Acquisition', 'acquisitions')
        ),
    });

    it('puts entities reached equally by class, then by name, not in the order they were reached', () => {
        const view = renderWithStore(<ReviewScreen />, orderBundle);
        act(() => view.store.getState().setStep('entities'));
        expect(cardNames('entities')).toEqual(['acq_1', 'grp_a', 'grp_z']);
    });

    it('lists hidden entities last in steps 3 and 4 once shown, whatever their name', () => {
        const hiddenRecord = {
            analyses: [
                {
                    local_id: 'a_1',
                    name: ev('First'),
                    groups: [
                        { group: 'grp_z', n: ev(1) },
                        { group: 'grp_h', n: ev(1) },
                    ],
                },
            ],
            groups: [
                { local_id: 'grp_h', name: ev('Alpha hidden') },
                { local_id: 'grp_z', name: ev('Zeta shown') },
                { local_id: 'grp_hu', name: ev('Alpha hidden, unused') },
                { local_id: 'grp_u', name: ev('Zeta shown, unused') },
            ],
        };
        const hiddenBundle = makeBundle(hiddenRecord, TEXT, {
            entities: entityRows(
                row('a_1', 'Analysis', 'analyses'),
                row('grp_h', 'Group', 'groups'),
                row('grp_z', 'Group', 'groups'),
                row('grp_hu', 'Group', 'groups'),
                row('grp_u', 'Group', 'groups')
            ),
            hidden: { analyses: [], entities: ['grp_h', 'grp_hu'] },
        });
        const view = renderWithStore(<ReviewScreen />, hiddenBundle);
        act(() => view.store.getState().toggleNonCoordinate());
        act(() => view.store.getState().setStep('entities'));
        expect(cardNames('entities')).toEqual(['grp_z', 'grp_h']);
        act(() => view.store.getState().setStep('leftovers'));
        expect(cardNames('leftovers')).toEqual(['grp_u', 'grp_hu']);
    });
});

describe('done means judged, accepted or rejected', () => {
    const reject = (store: ReturnType<typeof setup>['store'], target: AnyTarget) =>
        act(
            () =>
                void store.getState().emit({
                    client_op_id: `reject-${JSON.stringify(target)}`,
                    type: 'verdict',
                    target,
                    verdict: 'reject',
                    reason: 'wrong_value',
                } as Op)
        );
    const stepButton = (name: RegExp) => screen.getByRole('button', { name });

    it('counts a rejected card in its step and marks it done', () => {
        const { store } = setup('analyses');
        reject(store, { kind: 'entity', entity: 'a_1' });
        expect(stepButton(/^Analyses/)).toHaveTextContent('1 of 2');
        expect(within(cardList('analyses')).getByRole('button', { name: /Patients > Controls/ })).toHaveTextContent(
            'done'
        );
    });

    it('counts a rejected link in the relationships step', () => {
        const { store } = setup('analyses');
        reject(store, { kind: 'relationship', entity: 'a_1', path: 'acquisitions', target_entity: 'acq_1' });
        expect(stepButton(/^Relationships/)).toHaveTextContent('1 of 3');
    });
});

describe('the relationship audit with hidden analyses and self links', () => {
    it('has a row for each hidden analysis once they are shown', () => {
        const { store } = setup('relationships');
        act(() => store.getState().toggleNonCoordinate());
        const rows = within(screen.getByRole('table', { name: 'relationship audit' }))
            .getAllByRole('rowheader')
            .map((h) => h.textContent);
        expect(rows).toEqual(['Patients > Controls', 'Controls > Patients', 'No coordinates']);
    });

    it('refuses an analysis linking to itself, and shows the mirror it names', () => {
        const mirrored = makeBundle(
            {
                analyses: [
                    { local_id: 'a_1', name: ev('First'), mirror_of: 'a_2' },
                    { local_id: 'a_2', name: ev('Second') },
                ],
            },
            TEXT,
            { entities: entityRows(row('a_1', 'Analysis', 'analyses'), row('a_2', 'Analysis', 'analyses')) }
        );
        const view = renderWithStore(<ReviewScreen />, mirrored);
        act(() => view.store.getState().setStep('relationships'));
        const audit = screen.getByRole('table', { name: 'relationship audit' });
        expect(within(audit).getByRole('button', { name: 'First → First' })).toBeDisabled();
        expect(within(audit).getByRole('button', { name: 'First → Second' })).toHaveAttribute('aria-pressed', 'true');
    });
});

describe('step 4, a leftover that something links to', () => {
    const scanner = (text: string, name: string) => ev(text, [at(name)]);
    const linkedRecord = {
        analyses: [{ local_id: 'a_1', name: ev('Patients > Controls'), acquisitions: ['acq_1'] }],
        acquisitions: [
            { local_id: 'acq_1', name: ev('fMRI'), device: 'dev_a' },
            { local_id: 'acq_x', name: ev('Spare scan'), device: 'dev_x' },
        ],
        devices: [
            { local_id: 'dev_a' },
            { local_id: 'dev_x', manufacturer: scanner('Philips', 'Twenty'), model: scanner('Achieva', 'Stroop') },
        ],
    };
    const linkedBundle = makeBundle(linkedRecord, TEXT, {
        entities: entityRows(
            row('a_1', 'Analysis', 'analyses'),
            row('acq_1', 'Acquisition', 'acquisitions'),
            row('acq_x', 'Acquisition', 'acquisitions'),
            row('dev_a', 'Device', 'devices'),
            row('dev_x', 'Device', 'devices')
        ),
    });
    const open = () => {
        const view = renderWithStore(<ReviewScreen />, linkedBundle);
        act(() => view.store.getState().setStep('leftovers'));
        act(() => view.store.getState().focusEntity('dev_x'));
        return view;
    };
    const actions = () => screen.getByRole('toolbar', { name: 'leftover actions' });

    it('lists the links a delete would leave dangling', () => {
        const { store } = open();
        expect(cardNames('leftovers')).toEqual(['acq_x', 'dev_x']);
        fireEvent.click(within(actions()).getByRole('button', { name: 'Delete' }));
        const dialog = screen.getByRole('dialog', { name: 'Delete dev_x?' });
        expect(within(dialog).getByRole('list', { name: 'dangling links' })).toHaveTextContent(
            'Spare scan · device → dev_x'
        );
        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
        expect(pending(store)).toEqual([{ type: 'delete_entity', target: { kind: 'entity', entity: 'dev_x' } }]);
    });

    it('merges into a linked entity: re-points the link, copies the one slot ticked, deletes it, as one batch', () => {
        const { store } = open();
        fireEvent.click(within(actions()).getByRole('button', { name: 'Merge into…' }));
        const dialog = screen.getByRole('dialog', { name: 'Merge dev_x into…' });
        fireEvent.click(within(dialog).getByRole('radio', { name: 'dev_a' }));
        fireEvent.click(within(dialog).getByRole('checkbox', { name: 'model' }));
        fireEvent.click(within(dialog).getByRole('button', { name: 'Merge' }));
        const device = (type: 'unlink' | 'link', target_entity: string) => ({
            type,
            target: { kind: 'relationship', entity: 'acq_x', path: 'device', target_entity },
        });
        const model = { kind: 'slot', entity: 'dev_a', path: 'model' };
        expect(pending(store)).toEqual([
            device('unlink', 'dev_x'),
            device('link', 'dev_a'),
            {
                type: 'set_value',
                target: model,
                value: { extraction_status: 'extracted', value: 'Achieva', value_source: 'reported' },
            },
            {
                type: 'set_evidence',
                target: model,
                evidence: {
                    status: 'present',
                    sets: [{ spans: [{ start_char: at('Stroop')[0], end_char: at('Stroop')[1] }] }],
                },
            },
            { type: 'delete_entity', target: { kind: 'entity', entity: 'dev_x' } },
        ]);
        const { groupOf, pending: ops } = store.getState();
        expect(new Set(ops.map((op) => groupOf[op.client_op_id] ?? op.client_op_id)).size).toBe(1);
    });

    it('refreshes what the merge dialog offers when the record changes under it', () => {
        const { store } = open();
        fireEvent.click(within(actions()).getByRole('button', { name: 'Merge into…' }));
        const dialog = screen.getByRole('dialog', { name: 'Merge dev_x into…' });
        expect(within(dialog).getByRole('radio', { name: 'dev_a' })).toBeInTheDocument();
        const without = (id: string): typeof linkedBundle => ({
            ...linkedBundle,
            record: {
                ...linkedBundle.record,
                devices: linkedRecord.devices.filter((device) => device.local_id !== id),
            },
            entities: linkedBundle.entities.filter((entity) => entity.local_id !== id),
        });
        act(() => store.getState().rebase(without('dev_a')));
        expect(within(dialog).queryByRole('radio', { name: 'dev_a' })).not.toBeInTheDocument();
        act(() => store.getState().rebase(linkedBundle));
        expect(within(dialog).getByRole('radio', { name: 'dev_a' })).toBeInTheDocument();
    });
});

import { act, fireEvent, screen, within } from '@testing-library/react';
import type { AnyTarget, Op } from '../contract/generated/review-ops';
import { withoutIds } from '../test/undoHelpers';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { renderWithStores } from '../test/render';
import { ReviewScreen } from './ReviewScreen';
import type { ReviewStores } from '../store/reviewStores';
import { focusedSpans } from '../test/stores';
import { acceptTarget } from '../inspector/actions';

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
    const view = renderWithStores(<ReviewScreen />, bundle);
    act(() => view.stores.view.getState().setStep(step));
    return view;
}

const cardList = (name: string) => screen.getByRole('list', { name });
/** The button of the step's card named `name`, not a value inside the open card that reads the same. */
const cardButton = (list: string, name: RegExp) =>
    within(cardList(list))
        .getAllByRole('button', { name })
        .find((b) => b.hasAttribute('data-card'))!;
const cardNames = (name: string) =>
    within(cardList(name))
        .getAllByRole('button', { name: /./ })
        .filter((b) => b.hasAttribute('data-card'))
        .map((b) => b.getAttribute('data-card'));

describe('step 2, analyses', () => {
    it('shows one card per analysis in record order, leaving out hidden ones until shown, then last', () => {
        const { stores } = setup('analyses');
        expect(cardNames('analyses')).toEqual(['a_1', 'a_2']);
        act(() => stores.view.getState().toggleNonCoordinate());
        expect(cardNames('analyses')).toEqual(['a_1', 'a_2', 'a_h']);
    });

    it('opens on the first analysis, with its name, slots and evidence, through the inspector’s card', () => {
        const { stores } = setup('analyses');
        expect(stores.view.getState().focus.entity).toBe('a_1');
        const card = screen.getByRole('region', { name: 'Patients > Controls' });
        expect(card.querySelector('[data-slot-key="slot:a_1:statistic"]')).toHaveTextContent('t');
        expect(card.querySelector('[data-slot-key="slot:a_1:groups[#0].n"]')).toHaveTextContent('20');
        expect(cardButton('analyses', /Patients > Controls/)).toHaveTextContent('3 evidence spans');
        expect(focusedSpans(stores)).toEqual([at('Twenty'), at('patients'), at('Stroop')]);
    });

    it('Shift+J and Shift+K move between the step’s cards; J and K between the slots of one', () => {
        const { stores } = setup('analyses');
        press('J', { shiftKey: true });
        expect(stores.view.getState().focus.entity).toBe('a_2');
        press('J', { shiftKey: true });
        expect(stores.view.getState().focus.entity).toBe('a_2');
        press('K', { shiftKey: true });
        expect(stores.view.getState().focus.entity).toBe('a_1');
        press('j');
        expect(stores.view.getState().focus.entity).toBe('a_1');
        expect(stores.view.getState().focus.slot).toBeDefined();
    });

    it('accepts and rejects on the card as the inspector does, and shows a judged card as done', () => {
        const { stores } = setup('analyses');
        const card = () => cardButton('analyses', /Patients > Controls/);
        expect(card()).not.toHaveTextContent('done');
        press('a');
        expect(stores.session.getState().provenance['entity:a_1']?.state).toBe('verified');
        expect(card()).toHaveTextContent('done');
        press('J', { shiftKey: true });
        press('r');
        expect(screen.getByRole('group', { name: 'reject Controls > Patients' })).toBeInTheDocument();
    });

    it('focuses an analysis when its card is clicked', () => {
        const { stores } = setup('analyses');
        fireEvent.click(cardButton('analyses', /Controls > Patients/));
        expect(stores.view.getState().focus.entity).toBe('a_2');
    });
});

describe('step 3, entities outward from the analyses', () => {
    it('lists the entities the analyses use once each, most used first, and opens on the first', () => {
        const { stores } = setup('entities');
        expect(cardNames('entities')).toEqual(['acq_1', 'grp_a']);
        expect(stores.view.getState().focus.entity).toBe('acq_1');
    });

    it('names the reviewer who checked each link', () => {
        const { stores } = setup('entities');
        act(() =>
            stores.session.setState({
                bundle: {
                    ...stores.session.getState().bundle,
                    reviewers: [{ user_id: 'u1', name: 'Ana', state: 'in_progress', op_count: 0, last_edit_at: null }],
                },
                provenance: { 'relationship:a_1:acquisitions:acq_1': { state: 'verified', user_id: 'u1', at: 'then' } },
            })
        );
        const links = screen.getByRole('list', { name: 'linked from' });
        expect(within(links).getAllByRole('listitem')[0]).toHaveTextContent('verified by Ana');
    });

    it('shows the analyses linked to the focused entity, so the links are checked there', () => {
        const { stores } = setup('entities');
        const links = screen.getByRole('list', { name: 'linked from' });
        expect(
            within(links)
                .getAllByRole('listitem')
                .map((li) => li.firstChild?.textContent)
        ).toEqual(['Patients > Controls · Acquisitions', 'Controls > Patients · Acquisitions']);
        fireEvent.click(within(links).getAllByRole('button', { name: 'Accept link' })[0]);
        expect(stores.session.getState().provenance['relationship:a_1:acquisitions:acq_1']?.state).toBe('verified');
        expect(within(links).getAllByRole('listitem')[0]).toHaveTextContent('verified');
        fireEvent.click(within(links).getAllByRole('button', { name: 'Unlink' })[1]);
        expect(stores.session.getState().pending.at(-1)).toMatchObject({
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
        const view = renderWithStores(<ReviewScreen />, judged);
        act(() => view.stores.view.getState().setStep('entities'));
        const card = (name: RegExp) => cardButton('entities', name);
        expect(card(/^Patients/)).toHaveTextContent('done');
        expect(card(/^fMRI/)).not.toHaveTextContent('done');
    });
});

describe('step 5, the relationship audit', () => {
    const cards = () => [
        ...screen.getByRole('list', { name: 'relationships' }).querySelectorAll<HTMLElement>(':scope > li'),
    ];
    const card = (name: string) => cards().find((c) => c.querySelector('[data-card]')?.textContent?.startsWith(name))!;
    const links = (name: string) => screen.getByRole('region', { name: `Links of ${name}` });
    const rowNames = (name: string) => [...links(name).querySelectorAll('.rv-link-name')].map((n) => n.textContent);

    it('has a card per analysis and in it a group per class the analysis links to, a row per link', () => {
        setup('relationships');
        expect(cards().map((c) => c.querySelector('[data-card]')?.getAttribute('data-card'))).toEqual(['a_1', 'a_2']);
        expect(within(links('Patients > Controls')).getByRole('group', { name: 'Acquisitions (1 linked)' }));
        expect(rowNames('Patients > Controls')).toEqual(['fMRI']);
    });

    it('leaves out the pairs that mean nothing: a list item’s links, and analyses against analyses', () => {
        setup('relationships');
        const groups = within(links('Patients > Controls'))
            .getAllByRole('group')
            .map((g) => g.getAttribute('aria-label'));
        expect(groups).toEqual(['Acquisitions (1 linked)']);
        expect(rowNames('Patients > Controls')).not.toContain('Patients');
    });

    it('shows each name whole, wrapping, with no table to scroll sideways', () => {
        const long =
            'Patients with social anxiety disorder > healthy controls, whole-brain voxel-based morphometry, FWE-corrected';
        const scan =
            '3 T Siemens Trio fMRI with a 32-channel head coil and multiband echo-planar imaging of the whole brain';
        const named = makeBundle(
            {
                analyses: [{ local_id: 'a_1', name: ev(long), acquisitions: ['acq_1'] }],
                acquisitions: [{ local_id: 'acq_1', name: ev(scan) }],
            },
            TEXT,
            { entities: entityRows(row('a_1', 'Analysis', 'analyses'), row('acq_1', 'Acquisition', 'acquisitions')) }
        );
        const { stores } = renderWithStores(<ReviewScreen />, named);
        act(() => stores.view.getState().setStep('relationships'));
        expect(screen.queryByRole('table')).toBeNull();
        expect(card(long).querySelector('[data-card]')).toHaveTextContent(long);
        const name = links(long).querySelector('.rv-link-name')!;
        expect(name).toHaveTextContent(new RegExp(`^${scan}$`));
        expect(name).not.toHaveAttribute('title');
    });

    it('completes its progress there: a card’s Accept all links judges each link it holds', () => {
        const { stores } = setup('relationships');
        const step = () => screen.getByRole('button', { name: /^Relationships/ });
        expect(step()).toHaveTextContent('0 of 2');
        fireEvent.click(within(card('Patients > Controls')).getByRole('button', { name: 'Accept all links' }));
        fireEvent.click(within(card('Controls > Patients')).getByRole('button', { name: 'Accept all links' }));
        expect(step()).toHaveTextContent('2 of 2');
        expect(stores.session.getState().provenance['relationship:a_1:acquisitions:acq_1']?.state).toBe('verified');
        expect(screen.getByRole('heading', { name: /relationship audit/ })).toHaveTextContent('2 of 2 done');
    });

    it('unlinks with the focused row’s Remove link', () => {
        const { stores } = setup('relationships');
        act(() => stores.view.getState().focusLink('slot:a_2:acquisitions', 'acq_1'));
        fireEvent.click(within(links('Controls > Patients')).getByRole('button', { name: 'Remove link' }));
        expect(stores.session.getState().pending.at(-1)).toMatchObject({
            type: 'unlink',
            target: { entity: 'a_2', path: 'acquisitions', target_entity: 'acq_1' },
        });
    });

    it.each([
        ['an empty list', { acquisitions: [] }],
        ['no such slot in the record', {}],
    ])('links through the picker where the analysis has no link yet: %s', (_, slot) => {
        const unlinked = makeBundle(
            {
                analyses: [{ local_id: 'a_1', name: ev('First'), ...slot }],
                acquisitions: [{ local_id: 'acq_1', name: ev('fMRI') }],
            },
            TEXT,
            { entities: entityRows(row('a_1', 'Analysis', 'analyses'), row('acq_1', 'Acquisition', 'acquisitions')) }
        );
        const { stores } = renderWithStores(<ReviewScreen />, unlinked);
        act(() => stores.view.getState().setStep('relationships'));
        expect(links('First')).toHaveTextContent('No acquisition linked');
        const picker = screen.getByRole('combobox', { name: 'link an acquisition to First' });
        fireEvent.keyDown(picker, { key: 'ArrowDown' });
        fireEvent.click(screen.getByRole('option', { name: 'fMRI' }));
        expect(stores.session.getState().pending.at(-1)).toMatchObject({
            type: 'link',
            target: { entity: 'a_1', path: 'acquisitions', target_entity: 'acq_1' },
        });
    });
});

describe('step 4, leftover entities', () => {
    const actions = () => screen.getByRole('toolbar', { name: 'leftover actions' });

    it('lists the entities no analysis reaches', () => {
        const { stores } = setup('leftovers');
        expect(cardNames('leftovers')).toEqual(['grp_b', 'grp_c']);
        expect(stores.view.getState().focus.entity).toBe('grp_b');
    });

    it('keeps one with an accept', () => {
        const { stores } = setup('leftovers');
        fireEvent.click(within(actions()).getByRole('button', { name: 'Keep' }));
        expect(stores.session.getState().provenance['entity:grp_b']?.state).toBe('verified');
    });

    it('links one to an analysis with the link action, through the analysis’s own slot for its class', async () => {
        const spare = makeBundle(
            {
                analyses: [{ local_id: 'a_1', name: ev('First'), acquisitions: [] }],
                acquisitions: [{ local_id: 'acq_x', name: ev('Spare scan') }],
            },
            TEXT,
            { entities: entityRows(row('a_1', 'Analysis', 'analyses'), row('acq_x', 'Acquisition', 'acquisitions')) }
        );
        const { stores } = renderWithStores(<ReviewScreen />, spare);
        act(() => stores.view.getState().setStep('leftovers'));
        fireEvent.click(within(actions()).getByRole('button', { name: 'Link to an analysis' }));
        fireEvent.click(await screen.findByRole('option', { name: 'First · Acquisitions' }));
        expect(stores.session.getState().pending.at(-1)).toMatchObject({
            type: 'link',
            target: { entity: 'a_1', path: 'acquisitions', target_entity: 'acq_x' },
        });
    });

    it('offers no list item’s slot to link a group through, which would retarget the item', async () => {
        setup('leftovers');
        fireEvent.click(within(actions()).getByRole('button', { name: 'Link to an analysis' }));
        fireEvent.focus(screen.getByRole('combobox', { name: /^link .* from$/ }));
        expect(await screen.findByText('no analysis can link it')).toBeInTheDocument();
    });

    it('merges one into another of its class, copying the slots chosen, as one batch', () => {
        const { stores } = setup('leftovers');
        act(() => stores.view.getState().focusEntity('grp_c'));
        fireEvent.click(within(actions()).getByRole('button', { name: 'Merge into…' }));
        const dialog = screen.getByRole('dialog', { name: 'Merge Patients again into…' });
        fireEvent.click(within(dialog).getByRole('radio', { name: 'Patients' }));
        fireEvent.click(within(dialog).getByRole('button', { name: 'Merge' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        const { pending, groupOf } = stores.session.getState();
        expect(pending.map((op) => op.type)).toEqual(['delete_entity']);
        expect(new Set(pending.map((op) => groupOf[op.client_op_id] ?? op.client_op_id)).size).toBe(1);
    });

    it('deletes one with the delete dialog', () => {
        const { stores } = setup('leftovers');
        fireEvent.click(within(actions()).getByRole('button', { name: 'Delete' }));
        const dialog = screen.getByRole('dialog', { name: 'Delete Controls?' });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
        expect(stores.session.getState().pending.at(-1)).toMatchObject({
            type: 'delete_entity',
            target: { entity: 'grp_b' },
        });
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
        const { stores } = renderWithStores(<ReviewScreen />, bundle);
        stepKey('J');
        expect(stores.view.getState().step).toBe('analyses');
        expect(stores.view.getState().focus.entity).toBe('a_1');
        act(() => void fireEvent.keyDown(document.body, { key: 'Ô', code: 'KeyJ', altKey: true, shiftKey: true }));
        expect(stores.view.getState().step).toBe('entities');
        stepKey('K');
        expect(stores.view.getState().step).toBe('analyses');
        stepKey('K');
        stepKey('K');
        expect(stores.view.getState().step).toBe('coordinates');
    });

    it('does not change step on Alt+J without Shift', () => {
        const { stores } = renderWithStores(<ReviewScreen />, bundle);
        act(() => void fireEvent.keyDown(document.body, { key: 'j', code: 'KeyJ', altKey: true }));
        expect(stores.view.getState().step).toBe('coordinates');
    });

    it('lists the step keys in the help', () => {
        renderWithStores(<ReviewScreen />, bundle);
        press('?', { shiftKey: true });
        const help = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
        expect(help).toHaveTextContent('Alt+Shift+J');
        expect(help).toHaveTextContent('Alt+Shift+K');
    });

    it('shows each step’s done count in the step bar', () => {
        const { stores } = setup('analyses');
        const stepButton = (name: RegExp) => screen.getByRole('button', { name });
        expect(stepButton(/^Analyses/)).toHaveTextContent('0 of 2');
        expect(stepButton(/^Entities/)).toHaveTextContent('0 of 2');
        expect(stepButton(/^Leftovers/)).toHaveTextContent('0 of 2');
        expect(stepButton(/^Relationships/)).toHaveTextContent('0 of 2');
        press('a');
        expect(stepButton(/^Analyses/)).toHaveTextContent('1 of 2');
        expect(stores.view.getState().step).toBe('analyses');
    });

    it('keeps the reviewer’s step when the bundle is rebased', () => {
        const { stores } = setup('leftovers');
        act(() => stores.session.getState().rebase(bundle));
        expect(stores.view.getState().step).toBe('leftovers');
    });
});

const pending = (stores: ReviewStores) => withoutIds(stores.session.getState().pending as Op[]);

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
        const view = renderWithStores(<ReviewScreen />, orderBundle);
        act(() => view.stores.view.getState().setStep('entities'));
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
        const view = renderWithStores(<ReviewScreen />, hiddenBundle);
        act(() => view.stores.view.getState().toggleNonCoordinate());
        act(() => view.stores.view.getState().setStep('entities'));
        expect(cardNames('entities')).toEqual(['grp_z', 'grp_h']);
        act(() => view.stores.view.getState().setStep('leftovers'));
        expect(cardNames('leftovers')).toEqual(['grp_u', 'grp_hu']);
    });
});

describe('done means judged, accepted or rejected', () => {
    const reject = (stores: ReturnType<typeof setup>['stores'], target: AnyTarget) =>
        act(
            () =>
                void stores.session.getState().emit({
                    client_op_id: `reject-${JSON.stringify(target)}`,
                    type: 'verdict',
                    target,
                    verdict: 'reject',
                    reason: 'wrong_value',
                } as Op)
        );
    const stepButton = (name: RegExp) => screen.getByRole('button', { name });

    it('counts a rejected card in its step and marks it done', () => {
        const { stores } = setup('analyses');
        reject(stores, { kind: 'entity', entity: 'a_1' });
        expect(stepButton(/^Analyses/)).toHaveTextContent('1 of 2');
        expect(cardButton('analyses', /Patients > Controls/)).toHaveTextContent('done');
    });

    it('counts a rejected link in the relationships step', () => {
        const { stores } = setup('analyses');
        reject(stores, { kind: 'relationship', entity: 'a_1', path: 'acquisitions', target_entity: 'acq_1' });
        expect(stepButton(/^Relationships/)).toHaveTextContent('1 of 2');
    });
});

describe('the relationship audit with hidden analyses and self links', () => {
    it('has a card for each hidden analysis once they are shown', () => {
        const { stores } = setup('relationships');
        act(() => stores.view.getState().toggleNonCoordinate());
        const names = [
            ...screen.getByRole('list', { name: 'relationships' }).querySelectorAll(':scope > li [data-card]'),
        ].map((head) => head.querySelector('.MuiListItemText-primary')?.textContent);
        expect(names).toEqual(['Patients > Controls', 'Controls > Patients', 'No coordinates']);
    });

    it('leaves an analysis’s mirror out of the audit, to its card', () => {
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
        const view = renderWithStores(<ReviewScreen />, mirrored);
        act(() => view.stores.view.getState().setStep('relationships'));
        expect(screen.queryByRole('list', { name: 'relationships' })).toBeNull();
        expect(screen.getByText('No links to audit.')).toBeInTheDocument();
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
        const view = renderWithStores(<ReviewScreen />, linkedBundle);
        act(() => view.stores.view.getState().setStep('leftovers'));
        act(() => view.stores.view.getState().focusEntity('dev_x'));
        return view;
    };
    const actions = () => screen.getByRole('toolbar', { name: 'leftover actions' });

    it('lists the links a delete would leave dangling', () => {
        const { stores } = open();
        expect(cardNames('leftovers')).toEqual(['acq_x', 'dev_x']);
        fireEvent.click(within(actions()).getByRole('button', { name: 'Delete' }));
        const dialog = screen.getByRole('dialog', { name: 'Delete Philips, Achieva?' });
        expect(within(dialog).getByRole('list', { name: 'dangling links' })).toHaveTextContent(
            'Spare scan · Device → Philips, Achieva'
        );
        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
        expect(pending(stores)).toEqual([{ type: 'delete_entity', target: { kind: 'entity', entity: 'dev_x' } }]);
    });

    it('merges into a linked entity: re-points the link, copies the one slot ticked, deletes it, as one batch', () => {
        const { stores } = open();
        fireEvent.click(within(actions()).getByRole('button', { name: 'Merge into…' }));
        const dialog = screen.getByRole('dialog', { name: 'Merge Philips, Achieva into…' });
        fireEvent.click(within(dialog).getByRole('radio', { name: 'dev_a' }));
        fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Model' }));
        fireEvent.click(within(dialog).getByRole('button', { name: 'Merge' }));
        const device = (type: 'unlink' | 'link', target_entity: string) => ({
            type,
            target: { kind: 'relationship', entity: 'acq_x', path: 'device', target_entity },
        });
        const model = { kind: 'slot', entity: 'dev_a', path: 'model' };
        expect(pending(stores)).toEqual([
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
        const { groupOf, pending: ops } = stores.session.getState();
        expect(new Set(ops.map((op) => groupOf[op.client_op_id] ?? op.client_op_id)).size).toBe(1);
    });

    it('refreshes what the merge dialog offers when the record changes under it', () => {
        const { stores } = open();
        fireEvent.click(within(actions()).getByRole('button', { name: 'Merge into…' }));
        const dialog = screen.getByRole('dialog', { name: 'Merge Philips, Achieva into…' });
        expect(within(dialog).getByRole('radio', { name: 'dev_a' })).toBeInTheDocument();
        const without = (id: string): typeof linkedBundle => ({
            ...linkedBundle,
            record: {
                ...linkedBundle.record,
                devices: linkedRecord.devices.filter((device) => device.local_id !== id),
            },
            entities: linkedBundle.entities.filter((entity) => entity.local_id !== id),
        });
        act(() => stores.session.getState().rebase(without('dev_a')));
        expect(within(dialog).queryByRole('radio', { name: 'dev_a' })).not.toBeInTheDocument();
        act(() => stores.session.getState().rebase(linkedBundle));
        expect(within(dialog).getByRole('radio', { name: 'dev_a' })).toBeInTheDocument();
    });
});

describe('the steps in a read-only tab', () => {
    const readOnly = (step: Parameters<typeof setup>[0]) => {
        const view = setup(step);
        act(() => view.stores.session.getState().setDevice('readonly'));
        return view;
    };

    it('still focuses an entity from its card, and disables accepting and unlinking the links into it', () => {
        const { stores } = readOnly('entities');
        fireEvent.click(cardButton('entities', /^Patients/));
        expect(stores.view.getState().focus.entity).toBe('grp_a');
        fireEvent.click(cardButton('entities', /^fMRI/));
        expect(stores.view.getState().focus.entity).toBe('acq_1');
        const links = screen.getByRole('list', { name: 'linked from' });
        [
            ...within(links).getAllByRole('button', { name: 'Accept link' }),
            ...within(links).getAllByRole('button', { name: 'Unlink' }),
        ].forEach((button) => expect(button).toBeDisabled());
    });

    it('disables the audit’s accept, reject and remove controls', () => {
        const { stores } = readOnly('relationships');
        act(() => stores.view.getState().focusLink('slot:a_1:acquisitions', 'acq_1'));
        screen.getAllByRole('button', { name: 'Accept all links' }).forEach((button) => expect(button).toBeDisabled());
        const row = within(screen.getByRole('toolbar', { name: 'actions on Patients > Controls → fMRI' }));
        ['Accept', 'Reject', 'Remove link'].forEach((name) => expect(row.getByRole('button', { name })).toBeDisabled());
    });

    it('disables the leftover actions', () => {
        readOnly('leftovers');
        within(screen.getByRole('toolbar', { name: 'leftover actions' }))
            .getAllByRole('button')
            .forEach((button) => expect(button).toBeDisabled());
    });

    it('offers no unlink on a reference', () => {
        const { stores } = readOnly('analyses');
        act(() => stores.view.getState().focusEntity('a_1'));
        expect(screen.getByRole('button', { name: 'fMRI' })).toBeInTheDocument();
        expect(screen.queryByLabelText('unlink fMRI')).not.toBeInTheDocument();
    });
});

describe('one count per step (image-12)', () => {
    const stepButton = (name: RegExp) => screen.getByRole('button', { name });
    const heading = () => screen.getByRole('heading', { name: /^analyses · / });

    it('counts what the step asks the reviewer to judge, the same in the step bar and the card list', () => {
        const { stores } = setup('analyses');
        expect(stepButton(/^Analyses/)).toHaveTextContent('0 of 2');
        expect(heading()).toHaveTextContent('analyses · 0 of 2 done');
        act(() => stores.view.getState().toggleNonCoordinate());
        expect(cardNames('analyses')).toEqual(['a_1', 'a_2', 'a_h']);
        expect(stepButton(/^Analyses/)).toHaveTextContent('0 of 2');
        expect(heading()).toHaveTextContent('analyses · 0 of 2 done');
    });
});

describe('moving on when a step is done (image-6)', () => {
    const judgeAll = (stores: ReviewStores, ids: string[]) =>
        ids.forEach((id) => act(() => void acceptTarget(stores, { kind: 'entity', entity: id })));

    it('offers the next step once the step’s last item is judged, and goes there', () => {
        const { stores } = setup('analyses');
        expect(screen.queryByRole('button', { name: 'Next: Entities →' })).not.toBeInTheDocument();
        judgeAll(stores, ['a_1']);
        expect(screen.queryByRole('button', { name: 'Next: Entities →' })).not.toBeInTheDocument();
        judgeAll(stores, ['a_2']);
        fireEvent.click(screen.getByRole('button', { name: 'Next: Entities →' }));
        expect(stores.view.getState().step).toBe('entities');
    });

    it('marks a done step with a check in the step bar', () => {
        const { stores } = setup('analyses');
        const analysesStep = () => screen.getByRole('button', { name: /^Analyses/ });
        expect(analysesStep().querySelector('.Mui-completed')).toBeNull();
        judgeAll(stores, ['a_1']);
        expect(analysesStep()).toHaveTextContent('1 of 2');
        expect(analysesStep().querySelector('.Mui-completed')).toBeNull();
        judgeAll(stores, ['a_2']);
        expect(analysesStep().querySelector('.Mui-completed')).not.toBeNull();
    });
});

describe('a hint per step', () => {
    beforeEach(() => localStorage.clear());
    const hint = () => screen.queryByRole('note', { name: 'what this step is for' });

    it('says in one line what the step is for', () => {
        setup('leftovers');
        expect(hint()).toHaveTextContent('Tables and entities no analysis uses: keep, link, merge or delete each.');
    });

    it('stays dismissed for that step, here and when the review is opened again', () => {
        const { stores, unmount } = setup('analyses');
        fireEvent.click(within(hint()!).getByRole('button', { name: 'dismiss' }));
        expect(hint()).toBeNull();
        act(() => stores.view.getState().setStep('entities'));
        expect(hint()).not.toBeNull();
        unmount();
        setup('analyses');
        expect(hint()).toBeNull();
    });
});

describe('a leftover table card', () => {
    const tableText = 'Intro.\n\nTable 1\nGroup\tn\nSAD\t174\n\nMore text.';
    const tableBundle = makeBundle(
        { tables: [{ local_id: 'tbl1', table_number: ev('Table 1'), caption: ev('Sample composition.') }] },
        tableText,
        {
            entities: entityRows(row('tbl1', 'Table', 'tables')),
            parsed_paper: { bibliography: { title: 'A paper' }, tables: [{ table_id: 't1', label: 'Table 1' }] },
        }
    );

    it('scrolls the paper to its table, though the card has no evidence', () => {
        const { stores } = renderWithStores(<ReviewScreen />, tableBundle);
        act(() => stores.view.getState().setStep('leftovers'));
        act(() => stores.view.getState().focusEntity('tbl1'));
        expect(stores.view.getState().reveal?.span[0]).toBe(tableText.indexOf('Group\tn'));
    });
});

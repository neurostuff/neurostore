import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { fakeServer } from '../test/fakeServer';
import { renderThroughServer, renderWithStores } from '../test/render';
import { focusedSpans } from '../test/stores';
import { relationshipKey } from '../model/targetKey';
import { sortSpans } from '../model/record';
import { ReviewScreen } from './ReviewScreen';

const TEXT = 'Twenty patients and twenty controls performed a Stroop task during a 3 T fMRI scan, rated on the LSAS.';
const at = (word: string): [number, number] => [TEXT.indexOf(word), TEXT.indexOf(word) + word.length];

const LONG_SCAN = 'fMRI · Siemens Trio 3 T, 32-channel head coil, multiband echo-planar imaging of the whole brain';

const record = {
    analyses: [
        {
            local_id: 'a_1',
            name: ev('Patients > Controls', [at('patients')]),
            acquisitions: ['acq_1'],
            assessments: ['asm_1'],
            tasks: [],
            regions: [],
            groups: [{ group: 'grp_a', n: ev(20, [at('Twenty')]) }],
        },
        { local_id: 'a_h', name: ev('No coordinates'), acquisitions: ['acq_1'] },
        { local_id: 'a_2', name: ev('Controls > Patients', [at('controls')]), acquisitions: ['acq_1'] },
    ],
    groups: [{ local_id: 'grp_a', name: ev('Patients', [at('patients')]) }],
    acquisitions: [
        { local_id: 'acq_1', name: ev(LONG_SCAN, [at('fMRI')]) },
        { local_id: 'acq_2', name: ev('Structural scan') },
    ],
    assessments: [
        { local_id: 'asm_1', name: ev('Liebowitz Social Anxiety Scale', [at('LSAS')]) },
        { local_id: 'asm_2', name: ev('Beck Depression Inventory') },
    ],
    tasks: [{ local_id: 'task_1', name: ev('Stroop', [at('Stroop')]) }],
};

const entities = entityRows(
    row('a_1', 'Analysis', 'analyses'),
    row('a_h', 'Analysis', 'analyses'),
    row('a_2', 'Analysis', 'analyses'),
    row('grp_a', 'Group', 'groups'),
    row('acq_1', 'Acquisition', 'acquisitions'),
    row('acq_2', 'Acquisition', 'acquisitions'),
    row('asm_1', 'Assessment', 'assessments'),
    row('asm_2', 'Assessment', 'assessments'),
    row('task_1', 'Task', 'tasks')
);

const bundle = makeBundle(record, TEXT, { entities, hidden: { analyses: ['a_h'], entities: [] } });

const press = (key: string, init: KeyboardEventInit = {}, target: Element = document.body) =>
    act(() => void fireEvent.keyDown(target, { key, ...init }));

function setup() {
    const view = renderWithStores(<ReviewScreen />, bundle);
    act(() => view.stores.view.getState().setStep('relationships'));
    return view;
}

const cards = () => [
    ...screen.getByRole('list', { name: 'relationships' }).querySelectorAll<HTMLElement>(':scope > li'),
];
const card = (name: string) => cards().find((c) => c.querySelector(`[data-card]`)?.textContent?.startsWith(name))!;
const linksOf = (name: string) => screen.getByRole('region', { name: `Links of ${name}` });
const group = (analysis: string, heading: RegExp) => within(linksOf(analysis)).getByRole('group', { name: heading });
const linkRow = (analysis: string, target: string) =>
    within(linksOf(analysis))
        .getAllByRole('listitem')
        .find((li) => li.querySelector('.rv-link-name')?.textContent === target)!;
const stepButton = () => screen.getByRole('button', { name: /^Relationships/ });
vi.setConfig({ testTimeout: 30_000 });

const LINK_A1_ACQ = relationshipKey('a_1', 'acquisitions', 'acq_1');
const LINK_A1_ASM = relationshipKey('a_1', 'assessments', 'asm_1');
const LINK_A2_ACQ = relationshipKey('a_2', 'acquisitions', 'acq_1');

describe('the relationships step, a list per analysis', () => {
    it('has one card per analysis in guided order, each head naming it with its count and Accept all links', () => {
        setup();
        expect(screen.queryByRole('table')).toBeNull();
        expect(cards().map((c) => c.querySelector('[data-card]')?.getAttribute('data-card'))).toEqual(['a_1', 'a_2']);
        expect(card('Patients > Controls')).toHaveTextContent('0 of 2 links judged');
        expect(card('Controls > Patients')).toHaveTextContent('0 of 1 links judged');
        expect(within(card('Controls > Patients')).getByRole('button', { name: 'Accept all links' })).toBeEnabled();
    });

    it('shows the focused card’s links and collapses every other card to its head and count', () => {
        const { stores } = setup();
        expect(stores.view.getState().focus.entity).toBe('a_1');
        expect(within(card('Patients > Controls')).getByRole('region', { name: 'Links of Patients > Controls' }));
        expect(within(card('Controls > Patients')).queryByRole('region')).toBeNull();
        expect(within(card('Controls > Patients')).queryByText(LONG_SCAN)).toBeNull();
        fireEvent.click(card('Controls > Patients').querySelector('[data-card]')!);
        expect(within(card('Patients > Controls')).queryByRole('region')).toBeNull();
        expect(linkRow('Controls > Patients', LONG_SCAN)).toBeDefined();
    });

    it('groups the links by class, headed with how many are linked, one row per link with the full name', () => {
        setup();
        const headings = within(linksOf('Patients > Controls'))
            .getAllByRole('group')
            .map((g) => g.getAttribute('aria-label'));
        expect(headings).toEqual(['Acquisitions (1 linked)', 'Assessments (1 linked)', 'Tasks (0 linked)']);
        const scan = linkRow('Patients > Controls', LONG_SCAN);
        expect(scan).toBeDefined();
        expect(scan.querySelector('.rv-link-name')).not.toHaveAttribute('title');
        expect(within(scan).getByText('unchecked')).toHaveAttribute('data-status', 'unchecked');
    });

    it('leaves out the classes the record has no entity of, list items’ links and links to other analyses', () => {
        setup();
        const region = linksOf('Patients > Controls');
        expect(within(region).queryByRole('group', { name: /^Regions/ })).toBeNull();
        expect(within(region).queryByRole('group', { name: /^Groups/ })).toBeNull();
        expect(within(region).queryByText('Patients')).toBeNull();
    });

    it('focuses a link from its row, highlighting the linked entity’s evidence and the analysis’s', () => {
        const { stores } = setup();
        fireEvent.click(linkRow('Patients > Controls', LONG_SCAN));
        expect(stores.view.getState().focus.key).toBe(LINK_A1_ACQ);
        const { index } = stores.session.getState();
        expect(focusedSpans(stores)).toEqual(
            sortSpans([...index.entity('acq_1')!.spans, ...index.entity('a_1')!.spans])
        );
    });

    it('highlights only the analysis’s evidence for a link to a hidden entity', () => {
        const hiding = makeBundle(record, TEXT, { entities, hidden: { analyses: ['a_h'], entities: ['asm_1'] } });
        const { stores } = renderWithStores(<ReviewScreen />, hiding);
        act(() => stores.view.getState().setStep('relationships'));
        act(() => stores.view.getState().focusLink('slot:a_1:assessments', 'asm_1'));
        expect(focusedSpans(stores)).toEqual(stores.session.getState().index.entity('a_1')!.spans);
    });

    it('accepts and rejects a link from the field actions beside its row, rejecting with a reason', () => {
        const { stores } = setup();
        fireEvent.click(linkRow('Patients > Controls', LONG_SCAN));
        const actions = () => within(linkRow('Patients > Controls', LONG_SCAN)).getByRole('toolbar');
        fireEvent.click(within(actions()).getByRole('button', { name: 'Accept' }));
        expect(stores.session.getState().pending.at(-1)).toMatchObject({
            type: 'verdict',
            verdict: 'accept',
            target: { kind: 'relationship', entity: 'a_1', path: 'acquisitions', target_entity: 'acq_1' },
        });
        expect(within(linkRow('Patients > Controls', LONG_SCAN)).getByText('verified')).toBeInTheDocument();
        fireEvent.click(linkRow('Patients > Controls', 'Liebowitz Social Anxiety Scale'));
        const reject = within(linkRow('Patients > Controls', 'Liebowitz Social Anxiety Scale')).getByRole('button', {
            name: 'Reject',
        });
        expect(reject).toHaveAttribute(
            'title',
            expect.stringMatching(/^reject the focused slot, entity or link.* \(r\)$/)
        );
        fireEvent.click(reject);
        const panel = screen.getByRole('group', { name: /^reject Patients > Controls → Liebowitz/ });
        fireEvent.click(within(panel).getByRole('radio', { name: '3 wrong entity' }));
        fireEvent.click(within(panel).getByRole('button', { name: 'Reject' }));
        expect(stores.session.getState().pending.at(-1)).toMatchObject({
            type: 'verdict',
            verdict: 'reject',
            reason: 'wrong_entity',
            target: { kind: 'relationship', entity: 'a_1', path: 'assessments', target_entity: 'asm_1' },
        });
        expect(
            within(linkRow('Patients > Controls', 'Liebowitz Social Anxiety Scale')).getByText('rejected')
        ).toBeInTheDocument();
    });

    it('removes a link with the row’s Remove link, not a checkbox', () => {
        const { stores } = setup();
        expect(screen.queryByRole('checkbox')).toBeNull();
        fireEvent.click(linkRow('Patients > Controls', LONG_SCAN));
        fireEvent.click(within(linkRow('Patients > Controls', LONG_SCAN)).getByRole('button', { name: 'Remove link' }));
        expect(stores.session.getState().pending.at(-1)).toMatchObject({
            type: 'unlink',
            target: { entity: 'a_1', path: 'acquisitions', target_entity: 'acq_1' },
        });
        expect(linkRow('Patients > Controls', LONG_SCAN)).toHaveTextContent('unlinking…');
    });

    it('accepts all the card’s unjudged links in one batch, one undo taking it back', async () => {
        const server = fakeServer([bundle]);
        const { stores, client } = await renderThroughServer(<ReviewScreen />, server, bundle.source.id);
        const saved = () => waitFor(() => expect(stores.session.getState().pending).toEqual([]), { timeout: 10_000 });
        act(() => stores.view.getState().setStep('relationships'));
        act(() => stores.view.getState().focusLink('slot:a_1:assessments', 'asm_1'));
        press('r');
        fireEvent.click(screen.getByRole('radio', { name: '1 wrong value' }));
        fireEvent.click(
            within(screen.getByRole('group', { name: /^reject / })).getByRole('button', { name: 'Reject' })
        );
        fireEvent.click(within(card('Patients > Controls')).getByRole('button', { name: 'Accept all links' }));
        expect(stores.session.getState().provenance[LINK_A1_ACQ]?.state).toBe('verified');
        expect(stores.session.getState().provenance[LINK_A1_ASM]?.state).toBe('removed');
        expect(card('Patients > Controls')).toHaveTextContent('2 of 2 links judged');
        expect(within(card('Patients > Controls')).getByRole('button', { name: 'Accept all links' })).toBeDisabled();
        expect(within(card('Patients > Controls')).getByRole('status')).toHaveTextContent(/^Accepted 1 link$/);
        await saved();
        press('z', { ctrlKey: true });
        await saved();
        expect(stores.session.getState().provenance[LINK_A1_ACQ]).toBeUndefined();
        expect(stores.session.getState().provenance[LINK_A1_ASM]?.state).toBe('removed');
        client.stop();
    });

    it('accepts the focused card’s links with Shift+A, as Accept all links does', () => {
        const { stores } = setup();
        press('A', { shiftKey: true });
        const { provenance } = stores.session.getState();
        expect(provenance[LINK_A1_ACQ]?.state).toBe('verified');
        expect(provenance[LINK_A1_ASM]?.state).toBe('verified');
        expect(provenance['entity:a_1']).toBeUndefined();
    });
});

describe('adding a link from the relationships step', () => {
    it('offers, under a group, the class’s entities not linked yet, by full name, and links the one picked', () => {
        const { stores } = setup();
        fireEvent.click(
            within(group('Patients > Controls', /^Acquisitions/)).getByRole('button', {
                name: '+ link another acquisition',
            })
        );
        const picker = screen.getByRole('combobox', { name: 'link another acquisition to Patients > Controls' });
        expect(picker).toHaveFocus();
        fireEvent.keyDown(picker, { key: 'ArrowDown' });
        expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Structural scan']);
        fireEvent.click(screen.getByRole('option', { name: 'Structural scan' }));
        expect(stores.session.getState().pending.at(-1)).toMatchObject({
            type: 'link',
            target: { kind: 'relationship', entity: 'a_1', path: 'acquisitions', target_entity: 'acq_2' },
        });
        expect(group('Patients > Controls', /^Acquisitions/)).toHaveTextContent('Structural scan · linking…');
    });

    const single = makeBundle(
        {
            analyses: [{ local_id: 'a_1', name: ev('First'), measure: 'mea_1', tasks: ['task_1'] }],
            measures: [
                { local_id: 'mea_1', name: ev('BOLD') },
                { local_id: 'mea_2', name: ev('CBF') },
            ],
            tasks: [{ local_id: 'task_1', name: ev('Stroop') }],
            model_estimations: [{ local_id: 'mdl_1', name: ev('GLM') }],
        },
        TEXT,
        {
            entities: entityRows(
                row('a_1', 'Analysis', 'analyses'),
                row('mea_1', 'Measure', 'measures'),
                row('mea_2', 'Measure', 'measures'),
                row('task_1', 'Task', 'tasks'),
                row('mdl_1', 'ModelEstimation', 'model_estimations')
            ),
        }
    );

    it('offers no other link where the slot holds one link only, or no entity is left to link', () => {
        const { stores } = renderWithStores(<ReviewScreen />, single);
        act(() => stores.view.getState().setStep('relationships'));
        expect(group('First', /^Measures \(1 linked\)/)).toBeInTheDocument();
        expect(group('First', /^Tasks \(1 linked\)/)).toBeInTheDocument();
        expect(within(linksOf('First')).queryByRole('button', { name: /^\+ link another/ })).toBeNull();
    });

    it('changes a single link from its row, unlinking the old and linking the new in one batch', () => {
        const { stores } = renderWithStores(<ReviewScreen />, single);
        act(() => stores.view.getState().setStep('relationships'));
        fireEvent.click(linkRow('First', 'BOLD'));
        fireEvent.click(within(linkRow('First', 'BOLD')).getByRole('button', { name: 'Change measure' }));
        const picker = screen.getByRole('combobox', { name: 'change the measure of First to' });
        expect(picker).toHaveFocus();
        fireEvent.keyDown(picker, { key: 'ArrowDown' });
        expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['CBF']);
        fireEvent.click(screen.getByRole('option', { name: 'CBF' }));
        const { pending, groupOf } = stores.session.getState();
        expect(
            pending.map((op) => [op.type, (op as { target: { target_entity?: string } }).target.target_entity])
        ).toEqual([
            ['unlink', 'mea_1'],
            ['link', 'mea_2'],
        ]);
        expect(new Set(pending.map((op) => groupOf[op.client_op_id])).size).toBe(1);
    });

    it('opens the same picker from the row’s Link, so it is never a no-op', () => {
        const { stores } = renderWithStores(<ReviewScreen />, single);
        act(() => stores.view.getState().setStep('relationships'));
        act(() => stores.view.getState().focusLink('slot:a_1:measure', 'mea_1'));
        press('l');
        expect(screen.getByRole('combobox', { name: 'change the measure of First to' })).toHaveFocus();
    });

    it('restores a changed link with one undo', async () => {
        const server = fakeServer([single]);
        const { stores, client } = await renderThroughServer(<ReviewScreen />, server, single.source.id);
        const saved = () => waitFor(() => expect(stores.session.getState().pending).toEqual([]), { timeout: 10_000 });
        act(() => stores.view.getState().setStep('relationships'));
        act(() => stores.view.getState().focusLink('slot:a_1:measure', 'mea_1'));
        press('l');
        fireEvent.keyDown(screen.getByRole('combobox', { name: /^change the measure/ }), { key: 'ArrowDown' });
        fireEvent.click(screen.getByRole('option', { name: 'CBF' }));
        await saved();
        expect(stores.session.getState().index.slot('slot:a_1:measure')?.references).toEqual(['mea_2']);
        press('z', { ctrlKey: true });
        await saved();
        expect(stores.session.getState().index.slot('slot:a_1:measure')?.references).toEqual(['mea_1']);
        client.stop();
    });

    it('shows a link kind the record leaves out, and linking it makes the slot in the shape the schema gives', async () => {
        const server = fakeServer([single]);
        const { stores, client } = await renderThroughServer(<ReviewScreen />, server, single.source.id);
        act(() => stores.view.getState().setStep('relationships'));
        const models = group('First', /^Model estimations \(0 linked\)/);
        expect(models).toHaveTextContent('No model estimation linked');
        const picker = within(models).getByRole('combobox', { name: 'link a model estimation to First' });
        fireEvent.keyDown(picker, { key: 'ArrowDown' });
        fireEvent.click(screen.getByRole('option', { name: 'GLM' }));
        await waitFor(() => expect(group('First', /^Model estimations/)).toHaveTextContent('(1 linked)'));
        const { record } = stores.session.getState();
        expect((record as { analyses: Record<string, unknown>[] }).analyses[0].model_estimation).toBe('mdl_1');
        client.stop();
    });

    it('leaves out of the picker an entity a link waiting for the server is linking', () => {
        const { stores } = setup();
        act(
            () =>
                void stores.session.getState().emit({
                    client_op_id: 'link-pending-1',
                    type: 'link',
                    target: { kind: 'relationship', entity: 'a_1', path: 'assessments', target_entity: 'asm_2' },
                })
        );
        expect(
            within(linksOf('Patients > Controls')).queryByRole('button', { name: '+ link another assessment' })
        ).toBeNull();
        press('j');
        press('j');
        press('l');
        fireEvent.keyDown(screen.getByRole('combobox', { name: /^link another assessment/ }), { key: 'ArrowDown' });
        expect(screen.queryAllByRole('option')).toEqual([]);
        expect(group('Patients > Controls', /^Assessments/)).toHaveTextContent('Beck Depression Inventory · linking…');
    });

    it('searches the picker by name', () => {
        setup();
        fireEvent.click(screen.getByRole('button', { name: '+ link another assessment' }));
        const picker = screen.getByRole('combobox', { name: /^link another assessment/ });
        fireEvent.change(picker, { target: { value: 'Beck' } });
        expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Beck Depression Inventory']);
    });

    it('shows a class with no link as “No <class> linked” with its picker', () => {
        setup();
        const tasks = group('Patients > Controls', /^Tasks/);
        expect(tasks).toHaveTextContent('No task linked');
        expect(within(tasks).getByRole('combobox', { name: 'link a task to Patients > Controls' })).not.toHaveFocus();
    });

    it('disables adding a link in a read-only tab', () => {
        const { stores } = setup();
        act(() => stores.session.getState().setDevice('readonly'));
        expect(screen.getByRole('button', { name: '+ link another acquisition' })).toBeDisabled();
        expect(within(group('Patients > Controls', /^Tasks/)).getByRole('combobox')).toBeDisabled();
    });

    it('keeps r and Enter typed in the picker from running a shortcut on the focused row', () => {
        const { stores } = setup();
        act(() => stores.view.getState().focusLink('slot:a_1:acquisitions', 'acq_1'));
        const picker = within(group('Patients > Controls', /^Tasks/)).getByRole('combobox');
        act(() => picker.focus());
        fireEvent.keyDown(picker, { key: 'r' });
        fireEvent.change(picker, { target: { value: 'r' } });
        expect(stores.view.getState().panel).toBeNull();
        fireEvent.keyDown(picker, { key: 'Enter' });
        expect(stores.view.getState().panel).toBeNull();
        expect(stores.view.getState().focus.key).toBe(LINK_A1_ACQ);
        expect(stores.session.getState().pending).toHaveLength(1);
        expect(stores.session.getState().pending[0]).toMatchObject({
            type: 'link',
            target: { entity: 'a_1', path: 'tasks', target_entity: 'task_1' },
        });
    });

    it('counts a link it makes as judged, added as the server marks it, and drops one it removes from both counts', async () => {
        const server = fakeServer([bundle]);
        const { stores, client } = await renderThroughServer(<ReviewScreen />, server, bundle.source.id);
        act(() => stores.view.getState().setStep('relationships'));
        expect(stepButton()).toHaveTextContent('0 of 3');
        fireEvent.click(screen.getByRole('button', { name: '+ link another acquisition' }));
        fireEvent.keyDown(screen.getByRole('combobox', { name: /^link another acquisition/ }), { key: 'ArrowDown' });
        fireEvent.click(screen.getByRole('option', { name: 'Structural scan' }));
        await waitFor(() => expect(stepButton()).toHaveTextContent('1 of 4'));
        expect(card('Patients > Controls')).toHaveTextContent('1 of 3 links judged');
        expect(within(linkRow('Patients > Controls', 'Structural scan')).getByText(/^added/)).toBeInTheDocument();
        fireEvent.click(linkRow('Patients > Controls', 'Structural scan'));
        fireEvent.click(
            within(linkRow('Patients > Controls', 'Structural scan')).getByRole('button', { name: 'Remove link' })
        );
        await waitFor(() => expect(stepButton()).toHaveTextContent('0 of 3'));
        expect(card('Patients > Controls')).toHaveTextContent('0 of 2 links judged');
        client.stop();
    });
});

describe('the relationships step’s keys', () => {
    it('moves through the link rows across cards with j and k', () => {
        const { stores } = setup();
        const key = () => stores.view.getState().focus.key;
        press('j');
        expect(key()).toBe(LINK_A1_ACQ);
        press('j');
        expect(key()).toBe(LINK_A1_ASM);
        press('j');
        expect(key()).toBe(LINK_A2_ACQ);
        expect(linkRow('Controls > Patients', LONG_SCAN)).toHaveAttribute('aria-current', 'true');
        press('j');
        expect(key()).toBe(LINK_A2_ACQ);
        press('k');
        expect(key()).toBe(LINK_A1_ASM);
    });

    it('accepts with a, rejects with r and notes with ; on the focused row, as on a field', () => {
        const { stores } = setup();
        press('j');
        press('a');
        expect(stores.session.getState().provenance[LINK_A1_ACQ]?.state).toBe('verified');
        press('j');
        press('r');
        expect(screen.getByRole('group', { name: /^reject Patients > Controls → Liebowitz/ })).toBeInTheDocument();
        press('Escape', {}, screen.getByRole('group', { name: /^reject / }));
        press(';');
        const note = screen.getByRole('textbox', { name: /^note on Patients > Controls → Liebowitz/ });
        fireEvent.change(note, { target: { value: 'the LSAS is the self-report' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
        expect(stores.session.getState().pending.at(-1)).toMatchObject({
            type: 'note',
            target: { kind: 'relationship', target_entity: 'asm_1' },
        });
    });

    it('moves from a card head to the links around it: k to the last before its card, j to its first', () => {
        const { stores } = setup();
        act(() => stores.view.getState().focusEntity('a_2'));
        press('k');
        expect(stores.view.getState().focus.key).toBe(LINK_A1_ASM);
        act(() => stores.view.getState().focusEntity('a_2'));
        press('j');
        expect(stores.view.getState().focus.key).toBe(LINK_A2_ACQ);
    });

    it('offers Next analysis after Accept all links, going to the next link no one has judged', () => {
        const { stores } = setup();
        fireEvent.click(within(card('Patients > Controls')).getByRole('button', { name: 'Accept all links' }));
        fireEvent.click(within(linksOf('Patients > Controls')).getByRole('button', { name: 'Next analysis' }));
        expect(stores.view.getState().focus.key).toBe(LINK_A2_ACQ);
        expect(linksOf('Controls > Patients')).toBeInTheDocument();
    });

    it('moves between the analysis cards with Shift+J and Shift+K', () => {
        const { stores } = setup();
        press('J', { shiftKey: true });
        expect(stores.view.getState().focus.entity).toBe('a_2');
        expect(linksOf('Controls > Patients')).toBeInTheDocument();
    });

    it('lists the keys a link row takes in the help sheet: j, k, Shift+A, a, r and ; for a note, n staying not reported', () => {
        setup();
        press('?');
        const sheet = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
        const label = (key: string) =>
            within(sheet)
                .getAllByRole('row')
                .find((r) => r.firstElementChild?.textContent === key && r.lastElementChild?.textContent === 'record')
                ?.children[1].textContent;
        expect(label('j')).toMatch(/next link on the relationships step/);
        expect(label('k')).toMatch(/previous link on the relationships step/);
        expect(label('Shift+A')).toMatch(/On the relationships step, its unjudged links/);
        expect(label('a')).toMatch(/^accept the focused slot, entity or link/);
        expect(label('r')).toMatch(/^reject the focused slot, entity or link/);
        expect(label(';')).toMatch(/^add a note to the focused slot, entity or link/);
        expect(label('n')).toMatch(/not reported/);
    });
});

describe('one count for the relationships step', () => {
    it('adds the cards’ counts up to the step bar’s', () => {
        const { stores } = setup();
        act(() => stores.view.getState().focusLink('slot:a_2:acquisitions', 'acq_1'));
        press('a');
        expect(stepButton()).toHaveTextContent('1 of 3');
        expect(card('Patients > Controls')).toHaveTextContent('0 of 2 links judged');
        expect(card('Controls > Patients')).toHaveTextContent('1 of 1 links judged');
        expect(screen.getByRole('heading', { name: /relationship audit/ })).toHaveTextContent('1 of 3 done');
    });
});

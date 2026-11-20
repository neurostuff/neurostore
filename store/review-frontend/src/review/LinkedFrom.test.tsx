import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { fakeServer } from '../test/fakeServer';
import { renderThroughServer, renderWithStores } from '../test/render';
import { focusedSpans } from '../test/stores';
import { sortSpans } from '../model/record';
import { relationshipKey } from '../model/targetKey';
import type { ReviewStores } from '../store/reviewStores';
import { ReviewScreen } from './ReviewScreen';

const TEXT = 'Meditators and controls did a Stroop task in an fMRI scan; a group term and a cohort term were modelled.';
const at = (word: string): [number, number] => [TEXT.indexOf(word), TEXT.indexOf(word) + word.length];

const press = (key: string) => act(() => void fireEvent.keyDown(document.body, { key }));

const level = (name: string, links: Record<string, string[]>) => ({ level: ev(name), ...links });

const record = {
    analyses: [
        {
            local_id: 'a_1',
            name: ev('Meditators > Controls', [at('Meditators')]),
            groups: [{ group: 'grp_c' }, { group: 'grp_a' }],
            acquisitions: ['acq_1'],
            model_estimation: 'mdl_1',
            effect: { cells: [{ term: 'trm_1', level: ev('MNPs'), direction: ev('positive') }] },
        },
        { local_id: 'a_2', name: ev('Controls > Meditators'), groups: [{ group: 'grp_c' }, { group: 'grp_a' }] },
        { local_id: 'a_3', name: ev('Meditators only'), groups: [{ group: 'grp_a' }] },
    ],
    groups: [
        {
            local_id: 'grp_a',
            name: ev('meditation-naïve participants (MNPs)', [at('Meditators')]),
            diagnostic_instrument: ['asm_1'],
        },
        { local_id: 'grp_c', name: ev('controls', [at('controls')]), diagnostic_instrument: ['asm_1'] },
    ],
    assessments: [{ local_id: 'asm_1', name: ev('Beck Depression Inventory') }],
    tasks: [
        {
            local_id: 'task_1',
            name: ev('Stroop', [at('Stroop')]),
            acquisitions: ['acq_1'],
            conditions: [{ local_id: 'cnd_1', name: ev('incongruent') }],
        },
    ],
    acquisitions: [{ local_id: 'acq_1', name: ev('fMRI', [at('fMRI')]) }],
    model_estimations: [
        {
            local_id: 'mdl_1',
            model_type: ev('GLM one'),
            terms: [
                {
                    local_id: 'trm_1',
                    name: ev('group', [at('group')]),
                    levels: [level('controls', { groups: ['grp_c'] }), level('MNPs', { groups: ['grp_a'] })],
                },
                {
                    local_id: 'trm_2',
                    name: ev('cohort', [at('cohort')]),
                    levels: [level('meditators', { groups: ['grp_a'] })],
                },
                {
                    local_id: 'trm_4',
                    name: ev('condition'),
                    levels: [level('incongruent', { conditions: ['cnd_1'] })],
                    interaction_with: ['trm_2'],
                },
            ],
        },
        {
            local_id: 'mdl_2',
            model_type: ev('GLM two'),
            terms: [
                {
                    local_id: 'trm_3',
                    name: ev('group'),
                    levels: [level('controls', { groups: ['grp_c'] }), level('MNPs', { groups: ['grp_a'] })],
                },
                { local_id: 'trm_6', name: ev('arm'), levels: [level('meditators', { groups: ['grp_a'] })] },
            ],
        },
    ],
};

const entities = entityRows(
    row('a_1', 'Analysis', 'analyses'),
    row('a_2', 'Analysis', 'analyses'),
    row('a_3', 'Analysis', 'analyses'),
    row('grp_a', 'Group', 'groups'),
    row('grp_c', 'Group', 'groups'),
    row('task_1', 'Task', 'tasks'),
    row('cnd_1', 'Condition', 'conditions', { parent: 'task_1' }),
    row('acq_1', 'Acquisition', 'acquisitions'),
    row('mdl_1', 'ModelEstimation', 'model_estimations'),
    row('trm_1', 'ModelTerm', 'terms', { parent: 'mdl_1' }),
    row('trm_2', 'ModelTerm', 'terms', { parent: 'mdl_1' }),
    row('trm_4', 'ModelTerm', 'terms', { parent: 'mdl_1' }),
    row('mdl_2', 'ModelEstimation', 'model_estimations'),
    row('trm_3', 'ModelTerm', 'terms', { parent: 'mdl_2' }),
    row('trm_6', 'ModelTerm', 'terms', { parent: 'mdl_2' }),
    row('asm_1', 'Assessment', 'assessments')
);

const bundle = makeBundle(record, TEXT, { entities });

const GROUP_LINK_1 = relationshipKey('trm_1', 'levels[#1].groups', 'grp_a');
const GROUP_LINK_3 = relationshipKey('trm_3', 'levels[#1].groups', 'grp_a');

vi.setConfig({ testTimeout: 30_000 });

function open(stores: ReviewStores, entity: string) {
    act(() => stores.view.getState().setStep('entities'));
    act(() => stores.view.getState().focusEntity(entity));
}

function setup(entity: string) {
    const view = renderWithStores(<ReviewScreen />, bundle);
    open(view.stores, entity);
    return view;
}

const section = () => screen.getByRole('region', { name: /^Linked from/ });
const links = () => within(section()).getByRole('list', { name: 'linked from' });
const sentences = () =>
    within(links())
        .getAllByRole('listitem')
        .filter((li) => li.parentElement === links())
        .map((li) => li.getAttribute('aria-label'));
const linkItem = (name: string) => within(links()).getByRole('listitem', { name });
const groupItem = () => linkItem("In 2 model estimations: the term 'group', level 2 ('MNPs') is this group");
/** Opens every group of links in the section. */
const expandAll = () =>
    within(section())
        .queryAllByRole('button', { expanded: false })
        .forEach((toggle) => fireEvent.click(toggle));
const COHORT = "Model term 'cohort' in model estimation 'GLM one': its level 1 ('meditators') is this group";
const COHORT_LINK = relationshipKey('trm_2', 'levels[#0].groups', 'grp_a');
const toolbarOf = (item: HTMLElement) => within(item).getByRole('toolbar', { name: /^actions on / });

describe('Linked from, on the entities step', () => {
    it('says what the section lists and what to do with it', () => {
        setup('grp_a');
        expect(within(section()).getByRole('heading')).toHaveTextContent('Linked from: what points to this group');
        expect(section()).toHaveTextContent(
            'Other parts of the record that refer to this group. Accept a link if it is right, or unlink it.'
        );
    });

    it('says each link as a sentence (linker’s kind, name, parent, slot’s role), analyses first, then in guided order', () => {
        setup('grp_a');
        expect(sentences()).toEqual([
            'In 2 analyses: its group 2 is this group',
            "Analysis 'Meditators only': its group 1 is this group",
            COHORT,
            "In 2 model estimations: the term 'group', level 2 ('MNPs') is this group",
            "Model term 'arm' in model estimation 'GLM two': its level 1 ('meditators') is this group",
        ]);
    });

    it('names a slot as the linker’s card does', () => {
        setup('mdl_1');
        expect(sentences()).toEqual(["Analysis 'Meditators > Controls': its model is this model estimation"]);
    });

    it('says a verb slot by the verb its card template gives it', () => {
        setup('trm_2');
        expect(sentences()).toEqual([
            "Model term 'condition' in model estimation 'GLM one': it interacts with this model term",
        ]);
    });

    it('groups linkers with no parent whose role has no subject, each doing what the slot says', () => {
        const { stores } = setup('asm_1');
        expect(sentences()).toEqual(['In 2 groups: each is diagnosed with this assessment']);
        expandAll();
        expect(
            within(linkItem('In 2 groups: each is diagnosed with this assessment'))
                .getAllByRole('listitem')
                .map((li) => li.getAttribute('aria-label'))
        ).toEqual([
            "Group 'meditation-naïve participants (MNPs)': it is diagnosed with this assessment",
            "Group 'controls': it is diagnosed with this assessment",
        ]);
        expect(stores.view.getState().focus.entity).toBe('asm_1');
    });

    it('says a task’s link, and a model term’s link to a condition of a task', () => {
        const { stores } = setup('acq_1');
        expect(sentences()).toEqual([
            "Analysis 'Meditators > Controls': its acquisitions include this acquisition",
            "Task 'Stroop': its acquisitions include this acquisition",
        ]);
        open(stores, 'cnd_1');
        expect(sentences()).toEqual([
            "Model term 'condition' in model estimation 'GLM one': its level 1 ('incongruent') is this condition",
        ]);
    });

    it('says an analysis’s link from a cell of its effect by the cell’s level', () => {
        setup('trm_1');
        expect(sentences()).toEqual([
            "Analysis 'Meditators > Controls': its effect's cell 1 ('MNPs') is this model term",
        ]);
    });

    it('groups identical links under a count, expanding to a row per parent with its own actions', () => {
        setup('grp_a');
        const toggle = within(groupItem()).getByRole('button', { name: /2 model estimations/ });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        const rows = within(groupItem()).getAllByRole('listitem');
        expect(rows.map((li) => li.getAttribute('aria-label'))).toEqual([
            "Model term 'group' in model estimation 'GLM one': its level 2 ('MNPs') is this group",
            "Model term 'group' in model estimation 'GLM two': its level 2 ('MNPs') is this group",
        ]);
        expect(rows.map((li) => within(li).getByRole('button', { name: /^open / }).textContent)).toEqual([
            'GLM one',
            'GLM two',
        ]);
        expect(within(groupItem()).getByRole('button', { name: 'Accept all 2' })).toBeEnabled();
    });

    it('opens the term from a chip inside an expanded group, not its parent', () => {
        const { stores } = setup('grp_a');
        fireEvent.click(within(groupItem()).getByRole('button', { name: /2 model estimations/ }));
        fireEvent.click(within(groupItem()).getByRole('button', { name: 'open group in GLM two' }));
        expect(stores.view.getState().focus.entity).toBe('trm_3');
    });

    it('keeps terms of one role but different names apart', () => {
        setup('grp_a');
        expect(linkItem(COHORT)).toBeInTheDocument();
        expect(
            linkItem("Model term 'arm' in model estimation 'GLM two': its level 1 ('meditators') is this group")
        ).toBeInTheDocument();
    });

    it('shows actions only on the focused row: the field actions and Unlink, Reject and Note opening by pointer', () => {
        const { stores } = setup('grp_a');
        expect(
            within(linkItem(COHORT))
                .queryAllByRole('button')
                .map((b) => b.textContent)
        ).toEqual(['cohort']);
        fireEvent.click(linkItem(COHORT));
        const toolbar = toolbarOf(linkItem(COHORT));
        expect(toolbar).toHaveAccessibleName(`actions on ${COHORT}`);
        expect(
            within(toolbar)
                .getAllByRole('button')
                .map((b) => b.textContent)
        ).toEqual(expect.arrayContaining(['Accept', 'Reject', 'Note', 'Unlink']));
        fireEvent.click(within(toolbar).getByRole('button', { name: 'Reject' }));
        const reject = within(linkItem(COHORT)).getByRole('group', { name: `reject ${COHORT}` });
        fireEvent.click(within(reject).getByRole('radio', { name: '1 wrong value' }));
        expect(stores.view.getState().panel?.kind).toBe('reject');
        expect(stores.view.getState().focus.key).toBe(COHORT_LINK);
        fireEvent.click(within(reject).getByRole('button', { name: 'Cancel' }));
        fireEvent.click(within(toolbarOf(linkItem(COHORT))).getByRole('button', { name: 'Note' }));
        const note = within(linkItem(COHORT)).getByRole('textbox', { name: `note on ${COHORT}` });
        fireEvent.click(note);
        expect(stores.view.getState().panel?.kind).toBe('note');
        fireEvent.click(within(linkItem(COHORT)).getByRole('button', { name: 'Cancel' }));
        fireEvent.click(within(toolbarOf(linkItem(COHORT))).getByRole('button', { name: 'Unlink' }));
        expect(stores.session.getState().pending.at(-1)).toMatchObject({
            type: 'unlink',
            target: { kind: 'relationship', entity: 'trm_2', path: 'levels[#0].groups', target_entity: 'grp_a' },
        });
    });

    it('groups links of one role with no parent too, a row per linker named by it, a lone role said alone', () => {
        setup('grp_a');
        const item = linkItem('In 2 analyses: its group 2 is this group');
        expect(within(item).getByRole('button', { name: 'Accept all 2' })).toBeEnabled();
        fireEvent.click(within(item).getByRole('button', { name: 'In 2 analyses' }));
        const rows = within(item).getAllByRole('listitem');
        expect(rows.map((li) => li.getAttribute('aria-label'))).toEqual([
            "Analysis 'Meditators > Controls': its group 2 is this group",
            "Analysis 'Controls > Meditators': its group 2 is this group",
        ]);
        expect(rows.map((li) => within(li).getByRole('button', { name: /^open / }).textContent)).toEqual([
            'Meditators > Controls',
            'Controls > Meditators',
        ]);
        expect(linkItem("Analysis 'Meditators only': its group 1 is this group")).toBeInTheDocument();
    });

    describe('the field keys on a link focused from its target’s card', () => {
        const focusCohort = () => {
            const view = setup('grp_a');
            fireEvent.click(linkItem(COHORT));
            return view;
        };

        it('a accepts the link', () => {
            const { stores } = focusCohort();
            const before = stores.session.getState().provenance;
            press('a');
            expect(stores.session.getState().provenance).toEqual({
                ...before,
                [COHORT_LINK]: expect.objectContaining({ state: 'verified' }),
            });
        });

        it('r rejects the link with a reason', () => {
            const { stores } = focusCohort();
            const before = stores.session.getState().provenance;
            press('r');
            const reject = within(linkItem(COHORT)).getByRole('group', { name: `reject ${COHORT}` });
            fireEvent.click(within(reject).getByRole('radio', { name: '1 wrong value' }));
            fireEvent.click(within(reject).getByRole('button', { name: 'Reject' }));
            expect(stores.session.getState().pending.at(-1)).toMatchObject({
                type: 'verdict',
                verdict: 'reject',
                target: { kind: 'relationship', entity: 'trm_2', path: 'levels[#0].groups', target_entity: 'grp_a' },
            });
            expect(stores.session.getState().provenance).toEqual({
                ...before,
                [COHORT_LINK]: expect.objectContaining({ state: 'removed' }),
            });
        });

        it('; notes the link', () => {
            const { stores } = focusCohort();
            const before = stores.session.getState().provenance;
            press(';');
            const note = within(linkItem(COHORT)).getByRole('textbox', { name: `note on ${COHORT}` });
            fireEvent.change(note, { target: { value: 'the cohort is the meditators' } });
            fireEvent.click(within(linkItem(COHORT)).getByRole('button', { name: 'Save note' }));
            expect(stores.session.getState().pending.at(-1)).toMatchObject({
                type: 'note',
                target: { kind: 'relationship', entity: 'trm_2', path: 'levels[#0].groups', target_entity: 'grp_a' },
            });
            expect(stores.session.getState().provenance).toEqual(before);
        });
    });

    it('accepts the group’s unjudged links in one batch, leaving a rejected one, one undo taking it back', async () => {
        const server = fakeServer([bundle]);
        const { stores, client } = await renderThroughServer(<ReviewScreen />, server, bundle.source.id);
        const saved = () => waitFor(() => expect(stores.session.getState().pending).toEqual([]), { timeout: 10_000 });
        open(stores, 'grp_a');
        fireEvent.click(within(groupItem()).getByRole('button', { name: /2 model estimations/ }));
        const first = within(groupItem()).getAllByRole('listitem')[0];
        fireEvent.click(first);
        press('r');
        fireEvent.click(within(first).getByRole('radio', { name: '1 wrong value' }));
        fireEvent.click(
            within(within(first).getByRole('group', { name: /^reject / })).getByRole('button', { name: 'Reject' })
        );
        await saved();
        const before = stores.session.getState().provenance;
        const undoSteps = stores.session.getState().undoStack.length;
        fireEvent.click(within(groupItem()).getByRole('button', { name: 'Accept the 1 left' }));
        expect(stores.session.getState().provenance).toEqual({
            ...before,
            [GROUP_LINK_3]: expect.objectContaining({ state: 'verified' }),
        });
        expect(stores.session.getState().provenance[GROUP_LINK_1]?.state).toBe('removed');
        expect(stores.session.getState().undoStack).toHaveLength(undoSteps + 1);
        expect(screen.getByRole('region', { name: 'Fields of meditation-naïve participants (MNPs)' })).toBeVisible();
        expect(screen.getAllByRole('status').map((s) => s.textContent)).toContain('Accepted 1 link');
        expect(within(groupItem()).getByRole('button', { name: 'Accept all 2' })).toBeDisabled();
        await saved();
        act(() => stores.session.getState().undo());
        await saved();
        expect(stores.session.getState().provenance[GROUP_LINK_3]).toBeUndefined();
        expect(stores.session.getState().provenance[GROUP_LINK_1]?.state).toBe('removed');
        client.stop();
    });

    it('opens the linker from its name’s chip', () => {
        const { stores } = setup('grp_a');
        const item = linkItem(
            "Model term 'cohort' in model estimation 'GLM one': its level 1 ('meditators') is this group"
        );
        fireEvent.click(within(item).getByRole('button', { name: 'open cohort' }));
        expect(stores.view.getState().focus.entity).toBe('trm_2');
    });

    it('focusing a row keeps the card open and highlights both entities’ evidence', () => {
        const { stores } = setup('grp_a');
        const item = linkItem(
            "Model term 'cohort' in model estimation 'GLM one': its level 1 ('meditators') is this group"
        );
        fireEvent.click(item);
        expect(stores.view.getState().focus).toMatchObject({
            entity: 'grp_a',
            key: relationshipKey('trm_2', 'levels[#0].groups', 'grp_a'),
        });
        expect(item).toHaveAttribute('aria-current', 'true');
        expect(focusedSpans(stores)).toEqual(sortSpans([at('cohort'), at('Meditators')]));
        expect(screen.getByRole('region', { name: 'Fields of meditation-naïve participants (MNPs)' })).toBeVisible();
        expect(screen.queryByRole('region', { name: 'Selected field' })).not.toBeInTheDocument();
    });

    it.each(['grp_a', 'trm_1'])('shows no slot path or item place anywhere in the section of %s', (entity) => {
        setup(entity);
        expandAll();
        const texts = document.createTreeWalker(section(), NodeFilter.SHOW_TEXT);
        const nodes: string[] = [];
        while (texts.nextNode()) nodes.push(texts.currentNode.textContent ?? '');
        const said = [
            ...nodes,
            ...[...section().querySelectorAll('[aria-label], [title]')].flatMap((el) => [
                el.getAttribute('aria-label') ?? '',
                el.getAttribute('title') ?? '',
            ]),
        ].join('\n');
        expect(said).not.toMatch(/\[#|\[\d|\w\.\w|_/);
    });
});

describe('a Linked from row’s field description', () => {
    it('is the hover hint of a row’s and a group’s text, for the linker’s slot, not of their controls', () => {
        setup('grp_a');
        const hint = /: The participant cohorts carrying this level, by identifier\.$/;
        for (const item of [linkItem(COHORT), groupItem()]) {
            expect(item).not.toHaveAttribute('title');
            expect(item.querySelector('.rv-linked-text')).toHaveAttribute('title', expect.stringMatching(hint));
        }
    });
});

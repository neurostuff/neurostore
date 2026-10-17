import { act, fireEvent, screen, within } from '@testing-library/react';
import type { Op } from '../contract/generated/review-ops';
import { ReviewScreen } from '../review/ReviewScreen';
import { ev, row } from '../test/bundles';
import {
    COORD_TEXT,
    coordinateBundle,
    coordinateResult,
    CUNEUS,
    ENTITIES,
    FACES,
    HOUSES,
    INSULA,
    key,
    LOCALIZER,
    PRECUNEUS,
    RECORD,
    revision,
    SCRAMBLED,
} from '../test/coordinates';
import { registeredSpans } from '../test/highlights';
import { renderWithStores } from '../test/render';
import { coordinateOpErrors } from '../test/schemas';

// These tests render the whole review screen and query it by role, which takes 1.5–3 s each in
// jsdom and more under the full parallel suite.
vi.setConfig({ testTimeout: 15_000 });

function setup(bundle = coordinateBundle()) {
    const view = renderWithStores(<ReviewScreen />, bundle, { now: () => 'now' });
    const session = () => view.stores.session.getState();
    const viewState = () => view.stores.view.getState();
    const pending = () => session().pending;
    return { ...view, session, viewState, pending };
}

const press = (key: string, init: KeyboardEventInit = {}, target: Element = document.activeElement ?? document.body) =>
    act(() => void fireEvent.keyDown(target, { key, ...init }));
const card = (name: string) => screen.getByRole('article', { name });
const grid = (name: string) => screen.getByRole('grid', { name: `points of ${name}` });
const rowsOf = (name: string) => within(grid(name)).getAllByRole('row').slice(1);
const toolbar = () => screen.getByRole('toolbar', { name: 'coordinate actions' });
const rowSpan = (text: string): [number, number] => [COORD_TEXT.indexOf(text), COORD_TEXT.indexOf(text) + text.length];
const target = (analysis_key: string) => ({ kind: 'coordinate_analysis' as const, analysis_key });

function expectValid(ops: Op[]) {
    expect(coordinateOpErrors(ops), JSON.stringify(ops)).toEqual([]);
}

describe('the coordinates step', () => {
    it('sets each table’s analyses beside the table, and a text analysis beside the passage it is read from', () => {
        const { container } = setup();
        const table = container.querySelector('table[data-table-id="t1"]')!;
        const beside = table.nextElementSibling as HTMLElement;
        expect(beside).toHaveAttribute('data-text-aside');
        expect(
            within(beside)
                .getAllByRole('article')
                .map((a) => a.getAttribute('aria-label'))
        ).toEqual([FACES.name, HOUSES.name]);
        const paragraph = [...container.querySelectorAll('.rv-paragraph')].find((p) =>
            p.textContent?.includes('x = 4, y = -60')
        )!;
        expect(within(paragraph.nextElementSibling as HTMLElement).getByRole('article')).toHaveAccessibleName(
            LOCALIZER.name
        );
    });

    it('names the reviewer who edited an analysis, on its card and in the inspector', () => {
        const view = setup();
        act(() =>
            view.stores.session.setState({
                bundle: {
                    ...view.stores.session.getState().bundle,
                    reviewers: [{ user_id: 'u1', name: 'Ana', state: 'in_progress', op_count: 0, last_edit_at: null }],
                },
                provenance: { [`coordinate_analysis:${FACES.key}`]: { state: 'edited', user_id: 'u1', at: 'then' } },
            })
        );
        expect(within(card(FACES.name)).getByText('edited by Ana')).toBeInTheDocument();
        act(() => view.stores.view.getState().focusAnalysis(FACES.key));
        expect(within(screen.getByRole('region', { name: FACES.name })).getByText('edited by Ana')).toBeInTheDocument();
    });

    it('shows each analysis’s name, role, status and points: x, y, z, the values, cluster size and label', () => {
        setup();
        const faces = card(FACES.name);
        expect(within(faces).getByText('result')).toBeInTheDocument();
        expect(within(faces).getByText('unchecked')).toBeInTheDocument();
        const headers = within(grid(FACES.name))
            .getAllByRole('columnheader')
            .map((h) => h.textContent);
        expect(headers).toEqual(['selected', 'x', 'y', 'z', 'values', 'cluster size', 'label']);
        const cells = rowsOf(FACES.name).map((row) =>
            within(row)
                .getAllByRole('gridcell')
                .slice(1)
                .map((cell) => cell.textContent)
        );
        expect(cells).toEqual([
            ['4', '-60', '40', 't 5.1', '', 'Precuneus'],
            ['-36', '20', '2', 't 4.2', '12', ''],
        ]);
    });

    it('highlights the table row of the focused point, the text keeping its offsets', () => {
        const { textRoot } = setup();
        expect(registeredSpans('rv-focus', textRoot())).toEqual([
            rowSpan('Precuneus\t4\t−60\t40\t5.1'),
            rowSpan('Insula\t-36\t20\t2\t4.2'),
        ]);
        press('j');
        press('j');
        expect(registeredSpans('rv-focus', textRoot())).toEqual([rowSpan('Insula\t-36\t20\t2\t4.2')]);
        expect(rowsOf(FACES.name)[1]).toHaveAttribute('aria-current', 'true');
        press('J', { shiftKey: true });
        expect(card(HOUSES.name)).toHaveAttribute('aria-current', 'true');
        expect(registeredSpans('rv-focus', textRoot())).toEqual([rowSpan('Cuneus\t10\t-80\t12\t3.3')]);
    });

    it('focuses a point by click and selects points with Space and Shift+click', () => {
        const { viewState } = setup();
        fireEvent.click(rowsOf(HOUSES.name)[0]);
        expect(viewState().coordinates).toEqual({ analysis: HOUSES.key, point: 0, selected: [] });
        press(' ');
        expect(rowsOf(HOUSES.name)[0]).toHaveAttribute('aria-selected', 'true');
        fireEvent.click(rowsOf(FACES.name)[1], { shiftKey: true });
        expect(viewState().coordinates).toEqual({ analysis: FACES.key, point: 1, selected: [1] });
        expect(rowsOf(FACES.name)[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('keeps analyses with no points hidden until Shift+H, then last, greyed and labelled', () => {
        const { viewState } = setup();
        expect(screen.queryByRole('article', { name: SCRAMBLED.name })).not.toBeInTheDocument();
        press('H', { shiftKey: true });
        expect(within(card(SCRAMBLED.name)).getByText('non-coordinate')).toBeInTheDocument();
        press('J', { shiftKey: true });
        press('J', { shiftKey: true });
        press('J', { shiftKey: true });
        expect(viewState().coordinates?.analysis).toBe(SCRAMBLED.key);
        press('H', { shiftKey: true });
        expect(screen.queryByRole('article', { name: SCRAMBLED.name })).not.toBeInTheDocument();
    });

    it('lists every coordinates key in the help', () => {
        setup();
        press('?', { shiftKey: true });
        const rows = within(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).getAllByRole('row');
        const coordinateKeys = rows
            .filter((row) => row.lastElementChild?.textContent === 'coordinates')
            .map((row) => row.firstElementChild?.textContent);
        expect(coordinateKeys).toEqual(
            expect.arrayContaining([
                'J',
                'Shift+J',
                'A',
                'R',
                'Shift+Backspace',
                'Enter',
                'Space',
                'P',
                'Backspace',
                'M',
                'S',
                'G',
                'C',
                ';',
            ])
        );
        expect(rows.map((row) => row.firstElementChild?.textContent)).toContain('Shift+H');
    });

    it('gives the grid, its rows and the actions roles and names, each action its key', () => {
        setup();
        expect(grid(FACES.name)).toHaveAttribute('aria-multiselectable', 'true');
        const buttons = within(toolbar()).getAllByRole('button');
        expect(buttons.map((b) => b.textContent)).toEqual([
            'Accept',
            'Reject',
            'Note',
            'Relabel',
            'Edit point',
            'Add point',
            'Remove point',
            'Move',
            'Split',
            'Merge',
            'Add analysis',
        ]);
        for (const button of buttons) expect(button).toHaveAttribute('aria-keyshortcuts');
    });
});

describe('coordinate actions, each emitted as the server applies it', () => {
    it('A accepts the focused analysis with a verdict op, the one way to judge it', () => {
        const { pending } = setup();
        press('a');
        expect(pending()).toEqual([
            { client_op_id: expect.any(String), type: 'verdict', target: target(FACES.key), verdict: 'accept' },
        ]);
        expectValid(pending());
        expect(within(card(FACES.name)).getByText('verified by u1')).toBeInTheDocument();
    });

    it('the Accept button does the same', () => {
        const { pending } = setup();
        fireEvent.click(within(toolbar()).getByRole('button', { name: 'Accept' }));
        expect(pending()).toEqual([
            expect.objectContaining({ type: 'verdict', verdict: 'accept', target: target(FACES.key) }),
        ]);
    });

    it('R relabels the focused analysis with a role from the schema', () => {
        const { pending } = setup();
        press('r');
        const role = screen.getByRole('combobox', { name: 'role' });
        expect(role).toHaveFocus();
        expect([...role.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
            'result',
            'anchor',
            'localization',
            'reference',
            'other',
        ]);
        fireEvent.change(role, { target: { value: 'anchor' } });
        press('Enter');
        expect(pending()).toEqual([
            expect.objectContaining({ action: 'relabel', role: 'anchor', target: target(FACES.key) }),
        ]);
        expectValid(pending());
    });

    it('relabelling to the role the analysis already has sends nothing', () => {
        const { pending } = setup();
        press('r');
        fireEvent.change(screen.getByRole('combobox', { name: 'role' }), { target: { value: 'result' } });
        press('Enter');
        expect(pending()).toEqual([]);
    });

    it('Shift+Backspace rejects the focused analysis with a verdict op and a reason; Reject asks the same', () => {
        const { pending } = setup();
        press('Backspace', { shiftKey: true });
        screen.getByRole('group', { name: `reject ${FACES.name}` });
        press('Escape');
        expect(screen.queryByRole('group', { name: `reject ${FACES.name}` })).not.toBeInTheDocument();
        expect(pending()).toEqual([]);
        fireEvent.click(within(toolbar()).getByRole('button', { name: 'Reject' }));
        expect(screen.getByRole('group', { name: `reject ${FACES.name}` })).toHaveFocus();
        press('4');
        press('Enter');
        expect(pending()).toEqual([
            {
                client_op_id: expect.any(String),
                type: 'verdict',
                target: target(FACES.key),
                verdict: 'reject',
                reason: 'duplicate',
            },
        ]);
        expectValid(pending());
        expect(within(card(FACES.name)).getByText('rejected by u1')).toBeInTheDocument();
    });

    it('; adds a note to the focused analysis', () => {
        const { pending } = setup();
        press(';');
        const note = screen.getByRole('textbox', { name: `note on ${FACES.name}` });
        fireEvent.change(note, { target: { value: 'two peaks of one contrast' } });
        press('Enter');
        expect(pending()).toEqual([
            expect.objectContaining({ type: 'note', target: target(FACES.key), note: 'two peaks of one contrast' }),
        ]);
    });

    it('Enter edits the focused point and emits edit_points with the whole list', () => {
        const { pending } = setup();
        press('j');
        press('Enter');
        const editor = screen.getByRole('group', { name: `edit point 1 of ${FACES.name}` });
        fireEvent.change(within(editor).getByRole('spinbutton', { name: 'z' }), { target: { value: '42' } });
        press('Enter');
        expect(pending()).toEqual([
            expect.objectContaining({
                action: 'edit_points',
                target: target(FACES.key),
                payload: { points: [{ ...PRECUNEUS, coordinates: [4, -60, 42] }, INSULA] },
            }),
        ]);
        expectValid(pending());
    });

    it('P adds a point, and Backspace removes the focused one, each as edit_points', () => {
        const { pending, session } = setup();
        press('p');
        const editor = screen.getByRole('group', { name: `edit a new point of ${FACES.name}` });
        for (const [axis, value] of [
            ['x', '1'],
            ['y', '2'],
            ['z', '3'],
        ])
            fireEvent.change(within(editor).getByRole('spinbutton', { name: axis }), { target: { value } });
        press('Enter');
        expect(pending()).toEqual([
            expect.objectContaining({
                action: 'edit_points',
                payload: { points: [PRECUNEUS, INSULA, { coordinates: [1, 2, 3] }] },
            }),
        ]);
        act(() => session().refuse([{ op: pending()[0], message: 'no' }]));
        press('j');
        press('Backspace');
        expect(pending()).toEqual([
            expect.objectContaining({
                action: 'edit_points',
                target: target(FACES.key),
                payload: { points: [INSULA] },
            }),
        ]);
        expectValid(pending());
    });

    it('M moves the selected points to another analysis chosen by type-ahead, as one batch of two edit_points', () => {
        const { pending } = setup();
        press('j');
        press(' ');
        press('m');
        const to = screen.getByRole('combobox', { name: 'move 1 point to' });
        fireEvent.change(to, { target: { value: 'Houses' } });
        fireEvent.click(screen.getByRole('option', { name: new RegExp(HOUSES.name) }));
        expect(pending()).toEqual([
            expect.objectContaining({
                action: 'edit_points',
                target: target(FACES.key),
                payload: { points: [INSULA] },
            }),
            expect.objectContaining({
                action: 'edit_points',
                target: target(HOUSES.key),
                payload: { points: [CUNEUS, PRECUNEUS] },
            }),
        ]);
        expectValid(pending());
    });

    it('M moves the focused point when none is selected', () => {
        const { pending } = setup();
        press('j');
        press('j');
        press('m');
        expect(screen.getByRole('combobox', { name: 'move 1 point to' })).toHaveFocus();
        fireEvent.click(within(toolbar()).getByRole('button', { name: 'Move' }));
        expect(pending()).toEqual([]);
    });

    it('S splits the focused analysis at the selected points: the selection first, the rest second', () => {
        const { pending } = setup();
        press('j');
        press('j');
        press(' ');
        press('s');
        expect(pending()).toEqual([
            expect.objectContaining({
                action: 'split',
                target: target(FACES.key),
                payload: { parts: [{ indices: [1] }, { indices: [0] }] },
            }),
        ]);
        expectValid(pending());
    });

    it('G merges the analyses selected with Space, the first in guided order taking the others, once confirmed', () => {
        const { pending } = setup();
        press('J', { shiftKey: true });
        press(' ');
        expect(within(card(HOUSES.name)).getByText('selected for merge')).toBeInTheDocument();
        press('K', { shiftKey: true });
        press('g');
        const dialog = screen.getByRole('dialog', { name: `Merge 2 analyses into ${FACES.name}?` });
        expect(within(dialog).getByRole('list', { name: 'cards removed' })).toHaveTextContent('Houses > Faces');
        expect(within(dialog).getByRole('list', { name: 'dangling links' })).toHaveTextContent(
            'Faces > Houses · mirror_of → Houses > Faces'
        );
        expect(pending()).toEqual([]);
        fireEvent.click(within(dialog).getByRole('button', { name: 'Merge' }));
        expect(pending()).toEqual([
            expect.objectContaining({ action: 'merge', target: target(FACES.key), payload: { with: [HOUSES.key] } }),
        ]);
        expectValid(pending());
    });

    it('the Merge button merges what Shift+click selected', () => {
        const { pending } = setup();
        fireEvent.click(within(card(LOCALIZER.name)).getByRole('heading'), { shiftKey: true });
        fireEvent.click(within(toolbar()).getByRole('button', { name: 'Merge' }));
        const dialog = screen.getByRole('dialog', { name: `Merge 2 analyses into ${FACES.name}?` });
        expect(within(dialog).queryByRole('list', { name: 'cards removed' })).not.toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Merge' }));
        expect(pending()).toEqual([
            expect.objectContaining({ action: 'merge', target: target(FACES.key), payload: { with: [LOCALIZER.key] } }),
        ]);
    });

    it('C adds an analysis to the focused analysis’s table, with a name, role and first point', () => {
        const { pending } = setup();
        press('c');
        const form = screen.getByRole('group', { name: 'edit the first point of a new analysis in Table 1' });
        fireEvent.change(within(form).getByRole('spinbutton', { name: 'x' }), { target: { value: '8' } });
        fireEvent.change(within(form).getByRole('spinbutton', { name: 'y' }), { target: { value: '9' } });
        fireEvent.change(within(form).getByRole('spinbutton', { name: 'z' }), { target: { value: '10' } });
        press('Enter');
        expect(within(form).getByRole('textbox', { name: 'name' })).toHaveAccessibleDescription('required');
        expect(pending()).toEqual([]);
        fireEvent.change(within(form).getByRole('textbox', { name: 'name' }), { target: { value: 'Faces > Objects' } });
        expect(within(form).getByRole('combobox', { name: 'role' })).toHaveValue('result');
        expect(within(form).getByRole('combobox', { name: 'coordinate space' })).toHaveValue('MNI');
        press('Enter');
        expect(pending()).toEqual([
            {
                client_op_id: expect.any(String),
                type: 'coordinate',
                target: { kind: 'coordinate_parse' },
                action: 'add',
                payload: {
                    analysis: {
                        origin: 'table',
                        table_id: 't1',
                        name: 'Faces > Objects',
                        role: 'result',
                        coordinate_space: 'MNI',
                        cells: [],
                        points: [{ coordinates: [8, 9, 10] }],
                    },
                },
            },
        ]);
        expectValid(pending());
    });

    it('adds an analysis to a table the parse found none in, from the table’s own button', () => {
        const { pending } = setup();
        fireEvent.click(screen.getByRole('button', { name: 'Add an analysis to Table 2' }));
        const form = screen.getByRole('group', { name: 'edit the first point of a new analysis in Table 2' });
        fireEvent.change(within(form).getByRole('textbox', { name: 'name' }), { target: { value: 'Scrambled' } });
        for (const axis of ['x', 'y', 'z'])
            fireEvent.change(within(form).getByRole('spinbutton', { name: axis }), { target: { value: '0' } });
        fireEvent.click(within(form).getByRole('button', { name: 'Add analysis' }));
        expect(pending()).toEqual([
            expect.objectContaining({
                action: 'add',
                payload: { analysis: expect.objectContaining({ table_id: 't2', name: 'Scrambled' }) },
            }),
        ]);
        expectValid(pending());
    });
});

describe('an open coordinate panel', () => {
    it('offers the analyses a rebase leaves, by the names it gives them', () => {
        const { session } = setup();
        press('j');
        press('m');
        const renamed = { ...HOUSES, name: 'Houses, rerun' };
        act(() =>
            session().rebase(
                coordinateBundle({
                    coordinate_revision: revision([FACES, renamed, LOCALIZER, SCRAMBLED]) as never,
                })
            )
        );
        fireEvent.change(screen.getByRole('combobox', { name: 'move 1 point to' }), { target: { value: 'Houses' } });
        expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
            expect.stringContaining('Houses, rerun'),
        ]);
    });
});

describe('after a coordinate result', () => {
    it('renders the result’s revision and keeps focus on the analysis that replaced the focused one', () => {
        const { pending, session, viewState } = setup();
        press('j');
        press(' ');
        press('s');
        const sent = pending();
        const first = {
            ...FACES,
            key: key(0x1a1),
            name: 'Faces > Houses (part 1)',
            derived_from: [FACES.key],
            points: [PRECUNEUS],
        };
        const second = {
            ...FACES,
            key: key(0x2a1),
            name: 'Faces > Houses (part 2)',
            derived_from: [FACES.key],
            points: [INSULA],
        };
        const provenance = {
            [`coordinate_analysis:${FACES.key}`]: { state: 'edited', user_id: 'u1', at: 'then' },
            [`coordinate_analysis:${first.key}`]: { state: 'added', user_id: 'u1', at: 'then' },
            [`coordinate_analysis:${second.key}`]: { state: 'added', user_id: 'u1', at: 'then' },
        };
        act(() =>
            session().confirm(
                coordinateResult(sent, [first, second, HOUSES, LOCALIZER, SCRAMBLED], { provenance }),
                sent
            )
        );
        expect(screen.queryByRole('article', { name: FACES.name })).not.toBeInTheDocument();
        expect(card(first.name)).toHaveAttribute('aria-current', 'true');
        expect(within(card(first.name)).getByText('added by u1')).toBeInTheDocument();
        expect(within(card(first.name)).queryByText('saving…')).not.toBeInTheDocument();
        expect(rowsOf(second.name)).toHaveLength(1);
        expect(viewState().coordinates).toEqual({ analysis: first.key, point: 0, selected: [] });
    });

    it('takes the record and entity index from the result, and offers the card an added analysis made', () => {
        const { pending, session, viewState } = setup();
        press('c');
        const form = screen.getByRole('group', { name: 'edit the first point of a new analysis in Table 1' });
        fireEvent.change(within(form).getByRole('textbox', { name: 'name' }), { target: { value: 'Faces > Objects' } });
        for (const axis of ['x', 'y', 'z'])
            fireEvent.change(within(form).getByRole('spinbutton', { name: axis }), { target: { value: '1' } });
        press('Enter');
        const sent = pending();
        const added = {
            ...FACES,
            key: key(0x5a5),
            name: 'Faces > Objects',
            points: [{ coordinates: [1, 1, 1] as [number, number, number] }],
        };
        const record = {
            analyses: [
                ...RECORD.analyses,
                { local_id: 'rv_0123456789ab', name: ev('Faces > Objects'), source_table_analysis: ev(added.key) },
            ],
        };
        const entities = [...ENTITIES, row('rv_0123456789ab', 'Analysis', 'analyses')];
        act(() =>
            session().confirm(
                coordinateResult(sent, [FACES, HOUSES, LOCALIZER, SCRAMBLED, added], { record, entities }),
                sent
            )
        );
        expect(session().index.entity('rv_0123456789ab')?.name).toBe('Faces > Objects');
        expect(card(added.name)).toHaveAttribute('aria-current', 'true');
        fireEvent.click(screen.getByRole('button', { name: 'Open the record’s card for Faces > Objects' }));
        expect(viewState().focus.entity).toBe('rv_0123456789ab');
        expect(viewState().coordinates).toBeNull();
        expect(screen.getByRole('region', { name: 'Faces > Objects' })).toBeInTheDocument();
    });

    it('reports the links a merge left dangling, as a delete does', () => {
        const { pending, session, viewState } = setup();
        act(() => viewState().toggleMerge(HOUSES.key));
        press('g');
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Merge' }));
        const sent = pending();
        const merged = {
            ...FACES,
            key: key(0x6a6),
            derived_from: [FACES.key, HOUSES.key],
            points: [PRECUNEUS, INSULA, CUNEUS],
        };
        const record = { analyses: [{ ...RECORD.analyses[0], source_table_analysis: ev(merged.key) }] };
        const after = { references: [{ entity: 'ana_faces', path: 'mirror_of', target_entity: 'ana_houses' }] };
        act(() =>
            session().confirm(
                coordinateResult(sent, [merged, LOCALIZER, SCRAMBLED], {
                    record,
                    entities: ENTITIES.slice(0, 2),
                    after,
                }),
                sent
            )
        );
        expect(screen.getByRole('status', { name: '' })).toHaveTextContent(
            'ana_faces mirror_of: left dangling by a delete or a merge (it points at ana_houses)'
        );
        expect(session().index.entity('ana_houses')).toBeUndefined();
    });

    it('reports the links a split leaves on its first part, as notices', () => {
        const { pending, session } = setup();
        press('j');
        press(' ');
        press('s');
        const sent = pending();
        const first = {
            ...FACES,
            key: key(0x1a1),
            name: 'Faces > Houses (part 1)',
            derived_from: [FACES.key],
            points: [PRECUNEUS],
        };
        const second = { ...first, key: key(0x2a1), name: 'Faces > Houses (part 2)', points: [INSULA, CUNEUS] };
        const after = { links: [{ entity: 'ana_faces', path: 'mirror_of', target_entity: 'ana_houses' }] };
        act(() =>
            session().confirm(coordinateResult(sent, [first, second, HOUSES, LOCALIZER, SCRAMBLED], { after }), sent)
        );
        expect(screen.getByRole('status', { name: '' })).toHaveTextContent(
            'ana_faces mirror_of: kept on the first part of a split (it points at ana_houses)'
        );
    });
});

describe('while a coordinate op is pending', () => {
    const accept: Op = {
        client_op_id: 'c-pending',
        type: 'coordinate',
        target: target(FACES.key),
        action: 'relabel',
        role: 'anchor',
    };

    it('no accept is sent, since the focused analysis’s key may change', () => {
        const { pending, session } = setup();
        act(() => void session().emitBatch([accept]));
        press('a');
        expect(pending()).toEqual([accept]);
    });

    it('no coordinate panel opens', () => {
        const { session } = setup();
        act(() => void session().emitBatch([accept]));
        press('r');
        expect(screen.queryByRole('combobox', { name: 'role' })).not.toBeInTheDocument();
    });

    it('a merge the dialog confirms is not sent', () => {
        const { pending, session } = setup();
        press('J', { shiftKey: true });
        press(' ');
        press('K', { shiftKey: true });
        press('g');
        const dialog = screen.getByRole('dialog', { name: `Merge 2 analyses into ${FACES.name}?` });
        act(() => void session().emitBatch([accept]));
        fireEvent.click(within(dialog).getByRole('button', { name: 'Merge' }));
        expect(pending()).toEqual([accept]);
    });

    it('an analysis the form adds is not sent', () => {
        const { pending, session } = setup();
        press('c');
        const form = screen.getByRole('group', { name: 'edit the first point of a new analysis in Table 1' });
        act(() => void session().emitBatch([accept]));
        fireEvent.change(within(form).getByRole('spinbutton', { name: 'x' }), { target: { value: '8' } });
        fireEvent.change(within(form).getByRole('spinbutton', { name: 'y' }), { target: { value: '9' } });
        fireEvent.change(within(form).getByRole('spinbutton', { name: 'z' }), { target: { value: '10' } });
        fireEvent.change(within(form).getByRole('textbox', { name: 'name' }), { target: { value: 'Faces > Objects' } });
        press('Enter');
        expect(pending()).toEqual([accept]);
    });

    it('the analyses a pending merge takes show as saving, with the one it joins into', () => {
        const { session } = setup();
        const merge: Op = {
            client_op_id: 'c-merge',
            type: 'coordinate',
            target: target(FACES.key),
            action: 'merge',
            payload: { with: [HOUSES.key] },
        };
        act(() => void session().emitBatch([merge]));
        expect(within(card(HOUSES.name)).getByText('saving…')).toBeInTheDocument();
        expect(within(card(FACES.name)).getByText('saving…')).toBeInTheDocument();
    });
});

describe('the coordinates step in a read-only tab', () => {
    it('keeps the inspector’s focus buttons working, and disables its edit actions and the panels they open', () => {
        const { stores, viewState } = setup();
        act(() => stores.session.getState().setDevice('readonly'));
        act(() => stores.view.setState({ offer: { entity: 'ana_faces' } }));
        const open = screen.getByRole('button', { name: /^Open the record’s card for / });
        expect(open).toBeEnabled();
        within(toolbar())
            .getAllByRole('button')
            .forEach((button) => expect(button).toBeDisabled());
        screen
            .getAllByRole('button', { name: /^Add an analysis to / })
            .forEach((button) => expect(button).toBeDisabled());
        press('r');
        press('c');
        expect(viewState().panel).toBeNull();
        fireEvent.click(open);
        expect(viewState().focus.entity).toBe('ana_faces');
        expect(viewState().coordinates).toBeNull();
    });
});

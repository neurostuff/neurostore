import { act, fireEvent, screen, within } from '@testing-library/react';
import { fakeHotIn } from '@neurosynth/coordinate-table/testing';
import { ReviewScreen } from '../review/ReviewScreen';
import { COORD_TEXT, coordinateBundle, FACES, INSULA, LOCALIZER, PRECUNEUS } from '../test/coordinates';
import { engageGrid, staticTable } from '../test/grid';
import { renderWithStores } from '../test/render';
import { coordinateOpErrors } from '../test/schemas';

// Handsontable does not lay out in jsdom; these tests drive the package's stand-in, which runs its hooks as it does.
vi.mock('@handsontable/react-wrapper', () => import('@neurosynth/coordinate-table/testing'));
vi.mock('handsontable/registry', () => ({ registerAllModules: () => {} }));

vi.setConfig({ testTimeout: 15_000 });

async function setup() {
    const view = renderWithStores(<ReviewScreen />, coordinateBundle(), { now: () => 'now' });
    const session = () => view.stores.session.getState();
    const grid = await engageGrid(FACES.name);
    const hot = () => fakeHotIn(screen.getByRole('group', { name: `edit the points of ${FACES.name}` }));
    const cells = () =>
        [...grid.querySelectorAll('tbody tr')].map((r) => [...r.querySelectorAll('td')].map((c) => c.textContent));
    return { ...view, session, pending: () => session().pending, hot, cells, grid };
}

const target = { kind: 'coordinate_analysis', analysis_key: FACES.key };
const press = (key: string, init: KeyboardEventInit = {}) =>
    act(() => void fireEvent.keyDown(document.body, { key, ...init }));

describe('the focused analysis’s points, read-only until the reviewer edits them', () => {
    const open = () => renderWithStores(<ReviewScreen />, coordinateBundle(), { now: () => 'now' });

    it('are a table with a caption when an analysis is focused, with no grid mounted', async () => {
        open();
        expect(within(staticTable(FACES.name)).getAllByRole('rowheader')).toHaveLength(2);
        await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
        expect(document.querySelector('table[data-fake-hot]')).toBeNull();
    });

    it('a click mounts the grid, on the cell clicked', async () => {
        open();
        const grid = await engageGrid(FACES.name, 1, 2);
        expect(fakeHotIn(grid).selection).toEqual([1, 2, 1, 2]);
        expect(screen.queryByRole('table', { name: `points of ${FACES.name}` })).not.toBeInTheDocument();
    });

    it('a character typed on the table goes into the grid’s cell', async () => {
        open();
        act(() => void fireEvent.keyDown(staticTable(FACES.name), { key: '7' }));
        const grid = await screen.findByRole('group', { name: `edit the points of ${FACES.name}` });
        expect(fakeHotIn(grid).editor).toEqual({ row: 0, prop: 'x', value: '7' });
    });

    it('leaving the analysis brings back the table, the edit open committed first', async () => {
        const { stores } = open();
        act(() => void fireEvent.keyDown(staticTable(FACES.name), { key: '7' }));
        await screen.findByRole('group', { name: `edit the points of ${FACES.name}` });
        act(() => stores.view.getState().focusAnalysis(LOCALIZER.key));
        expect(staticTable(LOCALIZER.name)).toBeInTheDocument();
        expect(screen.queryByRole('group', { name: /^edit the points of/ })).not.toBeInTheDocument();
        expect(stores.session.getState().pending).toEqual([
            expect.objectContaining({
                action: 'edit_points',
                target,
                payload: { points: [{ ...PRECUNEUS, coordinates: [7, -60, 40] }, INSULA] },
            }),
        ]);
    });
});

describe('the focused analysis’s points, in a spreadsheet', () => {
    it('shows every point: x, y, z, the value’s kind and value, cluster size and the rest', async () => {
        const { cells } = await setup();
        expect(cells()).toEqual([
            ['4', '-60', '40', 't', '5.1', ''],
            ['-36', '20', '2', 't', '4.2', '12'],
        ]);
        fireEvent.click(screen.getByRole('button', { name: 'More columns' }));
        expect(cells()).toEqual([
            ['4', '-60', '40', 't', '5.1', '', '', '', 'Precuneus', ''],
            ['-36', '20', '2', 't', '4.2', '12', '', '', '', ''],
        ]);
        expect(screen.getByRole('button', { name: 'More columns' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('selecting a row focuses its point and shows its row in the text, the passage beside the grid', async () => {
        const { hot, stores } = await setup();
        act(() => hot().selectCell(1, 0));
        expect(stores.view.getState().coordinates?.point).toBe(1);
        const row = COORD_TEXT.indexOf('Insula');
        expect(stores.view.getState().reveal?.span[0]).toBe(row);
    });

    it('sends a cell edit as one edit_points op carrying every point', async () => {
        const { hot, pending } = await setup();
        act(() => hot().edit(0, 'z', 42));
        expect(pending()).toEqual([
            expect.objectContaining({
                type: 'coordinate',
                action: 'edit_points',
                target,
                payload: { points: [{ ...PRECUNEUS, coordinates: [4, -60, 42] }, INSULA] },
            }),
        ]);
        expect(coordinateOpErrors(pending())).toEqual([]);
    });

    it('sends a paste of new rows as one op, the pasted text read as numbers', async () => {
        const { hot, pending } = await setup();
        act(() =>
            hot().paste(2, 0, [
                ['1', '−2', '3'],
                ['4', '5', '6'],
            ])
        );
        expect(pending()).toHaveLength(1);
        expect(pending()[0]).toMatchObject({
            payload: { points: [PRECUNEUS, INSULA, { coordinates: [1, -2, 3] }, { coordinates: [4, 5, 6] }] },
        });
        expect(coordinateOpErrors(pending())).toEqual([]);
    });

    it('sends a fill and a row delete as one op each', async () => {
        const { hot, pending, session } = await setup();
        act(() => hot().fill(0, 'z', 1));
        expect(pending()).toEqual([
            expect.objectContaining({ payload: { points: [PRECUNEUS, { ...INSULA, coordinates: [-36, 20, 40] }] } }),
        ]);
        act(() => session().refuse([{ op: pending()[0], message: 'no' }]));
        act(() => hot().selectRows(0, 0));
        fireEvent.click(screen.getByRole('button', { name: 'Delete row(s)' }));
        expect(pending()).toEqual([expect.objectContaining({ payload: { points: [INSULA] } })]);
    });

    it('marks an invalid cell and sends nothing until it is valid', async () => {
        const { hot, pending, grid } = await setup();
        act(() => hot().edit(1, 'x', 'left'));
        expect(pending()).toEqual([]);
        expect(grid.querySelector('td.htInvalid')).toHaveTextContent('left');
        act(() => hot().edit(1, 'x', -30));
        expect(pending()).toHaveLength(1);
    });

    it('asks for a value’s kind before sending a value', async () => {
        const { hot, pending } = await setup();
        act(() => hot().edit(1, 'values.kind', ''));
        expect(pending()).toEqual([]);
        expect(screen.getByText('row 2: a value needs its statistic')).toBeInTheDocument();
    });

    it('shows the sent points, read-only, until the server answers; a refusal brings back the analysis’s', async () => {
        const { hot, pending, session, cells } = await setup();
        act(() => hot().edit(0, 'z', 42));
        expect(cells()[0][2]).toBe('42');
        expect(hot().props.columns?.[0].readOnly).toBe(true);
        act(() => session().refuse([{ op: pending()[0], message: 'refused' }]));
        expect(cells()[0][2]).toBe('40');
        expect(hot().props.columns?.[0].readOnly).toBe(false);
    });

    it('shows the analysis’s space in an empty space cell', async () => {
        const { hot } = await setup();
        fireEvent.click(screen.getByRole('button', { name: 'More columns' }));
        expect(hot().props.columns?.find((c) => c.data === 'space')).toMatchObject({
            placeholder: 'MNI (from analysis)',
        });
    });

    it('Enter, and Edit point, select the focused point’s row, or the first when none is focused', async () => {
        const { hot, stores } = await setup();
        press('Enter');
        expect(hot().selection).toEqual([0, 0, 0, 0]);
        expect(stores.view.getState().coordinates?.point).toBe(0);
        press('j');
        fireEvent.click(
            within(screen.getByRole('toolbar', { name: 'coordinate actions' })).getByRole('button', {
                name: 'Edit point',
            })
        );
        expect(hot().selection).toEqual([1, 0, 1, 0]);
    });

    it('follows the focus to another analysis once engaged there, the same grid showing its points', async () => {
        const { stores, hot } = await setup();
        const before = hot();
        act(() => stores.view.getState().focusAnalysis(LOCALIZER.key));
        const grid = await engageGrid(LOCALIZER.name);
        expect(fakeHotIn(grid)).toBe(before);
        expect([...grid.querySelectorAll('tbody tr')].map((r) => r.querySelector('td')?.textContent)).toEqual(['4']);
    });
});

describe('keys typed in the grid', () => {
    it('are the grid’s, not the review’s shortcuts', async () => {
        const { grid, pending, stores } = await setup();
        const cell = grid.querySelector('td')!;
        act(() => void fireEvent.keyDown(cell, { key: 'a' }));
        act(() => void fireEvent.keyDown(cell, { key: 'J', shiftKey: true }));
        expect(pending()).toEqual([]);
        expect(stores.view.getState().coordinates?.analysis).toBe(FACES.key);
    });

    it('but for undo, which the review keeps', async () => {
        const { grid, stores } = await setup();
        const undo = vi.spyOn(stores.session.getState(), 'undo');
        act(() => void fireEvent.keyDown(grid.querySelector('td')!, { key: 'z', ctrlKey: true }));
        expect(undo).toHaveBeenCalledTimes(1);
    });
});

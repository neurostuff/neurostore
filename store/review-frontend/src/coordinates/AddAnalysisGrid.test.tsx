import { act, fireEvent, screen, within } from '@testing-library/react';
import { fakeHotIn } from '@neurosynth/coordinate-table/testing';
import { ReviewScreen } from '../review/ReviewScreen';
import { COORD_TEXT, coordinateBundle, FACES } from '../test/coordinates';
import { engageGrid } from '../test/grid';
import { renderWithStores } from '../test/render';
import { coordinateOpErrors } from '../test/schemas';
import { selectText } from '../test/selection';

// Handsontable does not lay out in jsdom; these tests drive the package's stand-in, which runs its hooks as it does.
vi.mock('@handsontable/react-wrapper', () => import('@neurosynth/coordinate-table/testing'));
vi.mock('handsontable/registry', () => ({ registerAllModules: () => {} }));

vi.setConfig({ testTimeout: 15_000 });

const SENTENCE = 'The precuneus peaked at x = 4, y = -60, z = 40 in the localizer.';

function setup() {
    const view = renderWithStores(<ReviewScreen />, coordinateBundle(), { now: () => 'now' });
    const pending = () => view.stores.session.getState().pending;
    const form = () => screen.getByRole('group', { name: 'new analysis in Table 2' });
    /** Opens the form on Table 2 and waits for its grid. */
    const open = async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Add an analysis to Table 2' }));
        const grid = await within(form()).findByRole(
            'group',
            { name: 'points of the new analysis' },
            { timeout: 10_000 }
        );
        fireEvent.change(within(form()).getByRole('textbox', { name: 'name' }), { target: { value: 'Scrambled' } });
        return { grid, hot: () => fakeHotIn(grid) };
    };
    const add = () => fireEvent.click(within(form()).getByRole('button', { name: 'Add analysis' }));
    const select = (phrase: string) =>
        selectText(view.textRoot(), [COORD_TEXT.indexOf(phrase), COORD_TEXT.indexOf(phrase) + phrase.length]);
    return { ...view, pending, form, open, add, select };
}

const fields = (grid: HTMLElement) => fakeHotIn(grid).props.columns?.map((column) => column.data);
const pointsSent = (ops: unknown[]) =>
    (ops[0] as { payload: { analysis: { points: unknown[] } } }).payload.analysis.points;

describe('the Add analysis form’s points', () => {
    it('are the point grid, open to edit, with the columns of point editing and one empty row', async () => {
        const { open, form } = setup();
        const edited = await engageGrid(FACES.name);
        const { grid, hot } = await open();
        expect(fields(grid)).toEqual(fields(edited));
        expect(hot().data).toEqual([{}]);
        expect(hot().props.columns?.every((column) => !column.readOnly)).toBe(true);
        expect(within(form()).queryByRole('table', { name: /^points of/ })).not.toBeInTheDocument();
        fireEvent.click(within(form()).getByRole('button', { name: 'More columns' }));
        fireEvent.click(screen.getAllByRole('button', { name: 'More columns' })[0]);
        expect(fields(grid)).toEqual(fields(edited));
        expect(fields(grid)).toContain('space');
    });

    it('show the form’s coordinate space in an empty space cell', async () => {
        const { open, form } = setup();
        const { hot } = await open();
        fireEvent.click(within(form()).getByRole('button', { name: 'More columns' }));
        fireEvent.change(within(form()).getByRole('combobox', { name: 'coordinate space' }), {
            target: { value: 'TAL' },
        });
        expect(hot().props.columns?.find((c) => c.data === 'space')).toMatchObject({
            placeholder: 'TAL (from analysis)',
        });
    });

    it('add an analysis with every row pasted, an empty row left out', async () => {
        const { open, add, pending } = setup();
        const { hot } = await open();
        act(() =>
            hot().paste(0, 0, [
                ['1', '2', '3'],
                ['4', '5', '6'],
                ['7', '8', '9'],
            ])
        );
        fireEvent.click(screen.getAllByRole('button', { name: 'Add row' }).at(-1)!);
        expect(hot().data).toHaveLength(4);
        add();
        expect(pointsSent(pending())).toEqual([
            { coordinates: [1, 2, 3] },
            { coordinates: [4, 5, 6] },
            { coordinates: [7, 8, 9] },
        ]);
        expect(coordinateOpErrors(pending())).toEqual([]);
    });

    it('take typing, a fill and a row delete', async () => {
        const { open, add, pending } = setup();
        const { hot } = await open();
        act(() =>
            hot().paste(0, 0, [
                ['1', '2', '3'],
                ['4', '5', '6'],
                ['0', '0', '0'],
            ])
        );
        act(() => hot().edit(0, 'z', '30'));
        act(() => hot().fill(0, 'z', 1));
        act(() => hot().selectRows(2, 2));
        fireEvent.click(screen.getAllByRole('button', { name: 'Delete row(s)' }).at(-1)!);
        add();
        expect(pointsSent(pending())).toEqual([{ coordinates: [1, 2, 30] }, { coordinates: [4, 5, 30] }]);
    });

    it('block Add while a cell is invalid, and mark it', async () => {
        const { open, add, pending } = setup();
        const { grid, hot } = await open();
        act(() => hot().paste(0, 0, [['1', 'left', '3']]));
        add();
        expect(pending()).toEqual([]);
        expect(grid.querySelector('td.htInvalid')).toHaveTextContent('left');
        act(() => hot().edit(0, 'y', '2'));
        act(() => hot().edit(0, 'values.kind', 't'));
        add();
        expect(pending()).toEqual([]);
        expect(within(grid.parentElement!).getByText('row 1: a value needs its value')).toBeInTheDocument();
    });

    it('block Add while a row is half filled', async () => {
        const { open, add, pending } = setup();
        const { grid, hot } = await open();
        act(() => hot().edit(0, 'x', '1'));
        add();
        expect(pending()).toEqual([]);
        expect(grid.querySelectorAll('td.htInvalid')).toHaveLength(2);
    });

    it('keep Enter and Esc pressed in the grid, which neither add nor cancel', async () => {
        const { open, form, pending } = setup();
        const { grid, hot } = await open();
        act(() => hot().paste(0, 0, [['1', '2', '3']]));
        act(() => void fireEvent.keyDown(grid.querySelector('td')!, { key: 'Enter' }));
        act(() => void fireEvent.keyDown(grid.querySelector('td')!, { key: 'Escape' }));
        expect(pending()).toEqual([]);
        expect(form()).toBeInTheDocument();
    });

    it('are hidden by the null switch, the analysis added with no points', async () => {
        const { open, add, form, pending } = setup();
        const { grid, hot } = await open();
        act(() => hot().paste(0, 0, [['1', '2', '3']]));
        fireEvent.click(within(form()).getByRole('switch', { name: 'no significant result: no points' }));
        expect(grid).not.toBeVisible();
        add();
        expect(pointsSent(pending())).toEqual([]);
    });

    it('start with the selection’s x, y and z as row 1 when added from the text', async () => {
        const { select } = setup();
        select(SENTENCE);
        fireEvent.click(screen.getByRole('button', { name: 'New coordinate analysis from selection' }));
        const form = screen.getByRole('group', { name: 'new analysis from the selected text' });
        const grid = await within(form).findByRole(
            'group',
            { name: 'points of the new analysis' },
            { timeout: 10_000 }
        );
        expect(
            [...grid.querySelectorAll('tbody tr')].map((r) =>
                [...r.querySelectorAll('td')].slice(0, 3).map((c) => c.textContent)
            )
        ).toEqual([['4', '-60', '40']]);
    });
});

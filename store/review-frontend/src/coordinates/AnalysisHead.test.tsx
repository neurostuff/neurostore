import { act, fireEvent, screen, within } from '@testing-library/react';
import { fakeHotIn } from '@neurosynth/coordinate-table/testing';
import type { ReviewBundle } from '../contract/generated/review-bundle';
import { ReviewScreen } from '../review/ReviewScreen';
import { coordinateBundle, FACES, HOUSES, LOCALIZER, PARSE, point } from '../test/coordinates';
import { engageGrid } from '../test/grid';
import { renderWithStores } from '../test/render';

// Handsontable does not lay out in jsdom; these tests drive the package's stand-in, which runs its hooks as it does.
vi.mock('@handsontable/react-wrapper', () => import('@neurosynth/coordinate-table/testing'));
vi.mock('handsontable/registry', () => ({ registerAllModules: () => {} }));

vi.setConfig({ testTimeout: 15_000 });

function setup() {
    const view = renderWithStores(<ReviewScreen />, coordinateBundle(), { now: () => 'now' });
    const viewState = () => view.stores.view.getState();
    return { ...view, viewState, focused: () => viewState().coordinates?.analysis };
}

const press = (key: string, init: KeyboardEventInit = {}) =>
    act(() => void fireEvent.keyDown(document.activeElement ?? document.body, { key, ...init }));
const head = (name: string) => screen.getByRole('group', { name: `${name}: card head` });
const inHead = (name: string, button: string) => within(head(name)).getByRole('button', { name: button });
const points = () => screen.getByRole('group', { name: /^actions on (point \d+|the points) of / });
const buttonsOf = (holder: HTMLElement) =>
    within(holder)
        .getAllByRole('button')
        .filter((b) => b.hasAttribute('aria-keyshortcuts'))
        .map((b) => b.textContent);

describe('the coordinate analysis card head', () => {
    it('says where the analysis is in the guided order, and its status', () => {
        setup();
        expect(head(FACES.name)).toHaveTextContent('Analysis 1 of 3');
        expect(head(FACES.name)).toHaveTextContent('unchecked');
    });

    it('moves to the next and the previous analysis, disabled at the ends, its hints naming Shift+J and Shift+K', () => {
        const { focused } = setup();
        expect(inHead(FACES.name, 'Previous')).toBeDisabled();
        expect(inHead(FACES.name, 'Next')).toHaveAttribute('title', 'next analysis (Shift+J)');
        fireEvent.click(inHead(FACES.name, 'Next'));
        expect(focused()).toBe(HOUSES.key);
        expect(head(HOUSES.name)).toHaveTextContent('Analysis 2 of 3');
        expect(inHead(HOUSES.name, 'Previous')).toHaveAttribute('title', 'previous analysis (Shift+K)');
        fireEvent.click(inHead(HOUSES.name, 'Next'));
        expect(focused()).toBe(LOCALIZER.key);
        expect(inHead(LOCALIZER.name, 'Next')).toBeDisabled();
        fireEvent.click(inHead(LOCALIZER.name, 'Previous'));
        expect(focused()).toBe(HOUSES.key);
    });

    it('holds the analysis’s keyed actions, and the point’s sit beside its points', () => {
        const { viewState } = setup();
        expect(buttonsOf(head(FACES.name))).toEqual([
            'Previous',
            'Next',
            'Accept',
            'Reject',
            'Note',
            'Edit analysis',
            'Change role',
            'Split',
            'Merge',
        ]);
        act(() => viewState().focusAnalysis(FACES.key, 1));
        expect(points()).toHaveAccessibleName(`actions on point 2 of ${FACES.name}`);
        expect(buttonsOf(points())).toEqual(['Edit point', 'Move to…']);
    });

    it('leaves no toolbar on the Coordinates step', () => {
        const { viewState } = setup();
        act(() => viewState().focusAnalysis(FACES.key, 0));
        expect(screen.queryAllByRole('toolbar')).toEqual([]);
    });
});

describe('the way on from a judged analysis', () => {
    it('after Accept, says so and offers the next analysis no one has judged', () => {
        const { viewState, focused } = setup();
        act(() => viewState().focusAnalysis(HOUSES.key));
        press('a');
        act(() => viewState().focusAnalysis(FACES.key));
        fireEvent.click(inHead(FACES.name, 'Accept'));
        expect(within(head(FACES.name)).getByRole('status')).toHaveTextContent(`Accepted ${FACES.name}`);
        fireEvent.click(within(head(FACES.name)).getByRole('button', { name: 'Next analysis' }));
        expect(focused()).toBe(LOCALIZER.key);
    });

    it('goes on to a later analysis no one has judged before an earlier one', () => {
        const { viewState, focused } = setup();
        act(() => viewState().focusAnalysis(HOUSES.key));
        press('a');
        fireEvent.click(within(head(HOUSES.name)).getByRole('button', { name: 'Next analysis' }));
        expect(focused()).toBe(LOCALIZER.key);
    });

    it('goes round to an earlier analysis no one has judged', () => {
        const { viewState, focused } = setup();
        act(() => viewState().focusAnalysis(LOCALIZER.key));
        press('a');
        fireEvent.click(within(head(LOCALIZER.name)).getByRole('button', { name: 'Next analysis' }));
        expect(focused()).toBe(FACES.key);
    });

    it('Note on the head opens the note on the analysis', () => {
        setup();
        fireEvent.click(inHead(FACES.name, 'Note'));
        expect(screen.getByRole('textbox', { name: `note on ${FACES.name}` })).toBeInTheDocument();
    });

    it('after Reject, says so and offers the next analysis', () => {
        const { focused } = setup();
        fireEvent.click(inHead(FACES.name, 'Reject'));
        press('4');
        press('Enter');
        expect(within(head(FACES.name)).getByRole('status')).toHaveTextContent(`Rejected ${FACES.name}`);
        fireEvent.click(within(head(FACES.name)).getByRole('button', { name: 'Next analysis' }));
        expect(focused()).toBe(HOUSES.key);
    });

    it('says nothing of an analysis judged before it was focused', () => {
        const { viewState } = setup();
        press('a');
        act(() => viewState().moveAnalysis(1));
        act(() => viewState().moveAnalysis(-1));
        expect(within(head(FACES.name)).getByRole('status')).toHaveTextContent('');
        expect(screen.queryByRole('button', { name: 'Next analysis' })).not.toBeInTheDocument();
    });

    it('once every analysis is judged, leaves the way on to the step guide’s next step', () => {
        const { viewState } = setup();
        press('a');
        act(() => viewState().moveAnalysis(1));
        press('a');
        act(() => viewState().moveAnalysis(1));
        press('a');
        expect(screen.getByRole('button', { name: 'Next: Analyses →' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Next analysis' })).not.toBeInTheDocument();
    });
});

describe('finding the way between analyses', () => {
    it('the step hint names Shift+J and Shift+K, and j and k', () => {
        setup();
        expect(screen.getByRole('note', { name: 'what this step is for' })).toHaveTextContent(
            'Shift+J and Shift+K move between analyses, j and k between points'
        );
    });

    it('the help sheet lists them under the coordinates scope', () => {
        setup();
        fireEvent.click(screen.getByRole('button', { name: 'Help' }));
        const rows = within(screen.getByRole('dialog', { name: 'Keyboard shortcuts' }))
            .getAllByRole('row')
            .filter((row) => row.lastElementChild?.textContent === 'coordinates')
            .map((row) => row.firstElementChild?.textContent);
        expect(rows).toEqual(expect.arrayContaining(['j', 'k', 'Shift+J', 'Shift+K']));
        expect(screen.getByRole('dialog')).toHaveTextContent('drag over rows in the grid');
    });

    it('the step hint names the drag over rows that selects points', () => {
        setup();
        expect(screen.getByRole('note', { name: 'what this step is for' })).toHaveTextContent('drag over rows');
    });
});

describe('the grid’s row selection is the point selection', () => {
    const MANY = { ...FACES, points: Array.from({ length: 8 }, (_, i) => point([i, i, i])) };
    async function open() {
        const parse = { ...PARSE, analyses: [MANY, HOUSES, LOCALIZER] } as ReviewBundle['coordinate_parse'];
        const view = renderWithStores(<ReviewScreen />, coordinateBundle({ coordinate_parse: parse }), {
            now: () => 'now',
        });
        const hot = fakeHotIn(await engageGrid(FACES.name));
        return { ...view, hot, viewState: () => view.stores.view.getState() };
    }

    it('dragging over rows 1–7 selects those points, and Split splits them off', async () => {
        const { hot, viewState, stores } = await open();
        act(() => hot.selectRows(0, 6));
        expect(viewState().coordinates?.selected).toEqual([0, 1, 2, 3, 4, 5, 6]);
        expect(inHead(FACES.name, 'Split')).toBeEnabled();
        fireEvent.click(inHead(FACES.name, 'Split'));
        expect(stores.session.getState().pending).toEqual([
            expect.objectContaining({
                action: 'split',
                payload: { parts: [{ indices: [0, 1, 2, 3, 4, 5, 6] }, { indices: [7] }] },
            }),
        ]);
    });

    it('a click on one cell clears the selection', async () => {
        const { hot, viewState } = await open();
        act(() => hot.selectRows(1, 3));
        act(() => hot.selectCell(5, 0));
        expect(viewState().coordinates).toMatchObject({ point: 5, selected: [] });
    });

    it('the selected points can be moved to another analysis', async () => {
        const { hot } = await open();
        act(() => hot.selectRows(0, 2));
        fireEvent.click(within(points()).getByRole('button', { name: 'Move to…' }));
        expect(screen.getByRole('combobox', { name: 'move 3 points to' })).toBeInTheDocument();
    });

    it('a click on one cell keeps the points Space selected', async () => {
        const { hot, viewState } = await open();
        act(() => viewState().togglePoint(1));
        act(() => hot.selectCell(3, 0));
        expect(viewState().coordinates).toMatchObject({ point: 3, selected: [1] });
    });

    it('dragging past the last point into the spare rows selects only the points', async () => {
        const { hot, viewState } = await open();
        act(() => hot.selectRows(5, MANY.points.length + 1));
        expect(viewState().coordinates?.selected).toEqual([5, 6, 7]);
    });
});

describe('why Split and Merge do not apply, without hovering', () => {
    it('says so under the head’s buttons', () => {
        setup();
        const reasons = within(head(FACES.name)).getByRole('list', { name: 'why some actions do not apply' });
        expect(reasons).toHaveTextContent('Select the points to split off: drag over rows or press Space');
        expect(reasons).toHaveTextContent(
            'Merge joins whole analyses: Shift-click another analysis’s card; to put these points in another analysis, use Move to…'
        );
    });
});

import { act, fireEvent, screen, within } from '@testing-library/react';
import type { ReviewBundle } from '../contract/generated/review-bundle';
import type { Op } from '../contract/generated/review-ops';
import { coordinateBundle, FACES, HOUSES, LOCALIZER, SCRAMBLED } from '../test/coordinates';
import { renderWithStores } from '../test/render';
import { AnalysisReasons } from './actionButtons';
import { ReviewScreen } from './ReviewScreen';

// Handsontable does not lay out in jsdom; these tests drive the package's stand-in, which runs its hooks as it does.
vi.mock('@handsontable/react-wrapper', () => import('@neurosynth/coordinate-table/testing'));
vi.mock('handsontable/registry', () => ({ registerAllModules: () => {} }));

vi.setConfig({ testTimeout: 15_000 });

function setup() {
    const view = renderWithStores(<ReviewScreen />, coordinateBundle(), { now: () => 'now' });
    return { ...view, viewState: () => view.stores.view.getState() };
}

/** The keyed action buttons on the focused analysis's head, then those beside its points. */
const actions = () =>
    [
        screen.queryByRole('group', { name: /: card head$/ }),
        screen.queryByRole('group', { name: /^actions on (point \d+|the points) of / }),
    ].flatMap((holder) =>
        holder
            ? within(holder)
                  .getAllByRole('button')
                  .filter((b) => b.hasAttribute('aria-keyshortcuts'))
            : []
    );
const button = (name: string) => actions().find((b) => b.textContent === name)!;
const enabled = () =>
    actions()
        .filter((b) => !b.hasAttribute('disabled'))
        .map((b) => b.textContent);

const reasonOf = (name: string) => button(name).getAttribute('title');

describe('coordinate actions that do not apply to the focus', () => {
    it('are disabled on an analysis with nothing selected: move, split and merge', () => {
        setup();
        expect(enabled()).toEqual(['Next', 'Accept', 'Reject', 'Note', 'Edit analysis', 'Change role', 'Edit point']);
    });

    it('name their key for assistive technology, enabled or not', () => {
        setup();
        expect(button('Accept')).toHaveAttribute('aria-keyshortcuts', 'a');
        expect(button('Note')).toHaveAttribute('aria-keyshortcuts', ';');
        expect(button('Split')).toHaveAttribute('aria-keyshortcuts', 's');
    });

    it('say why in their hint', () => {
        setup();
        expect(reasonOf('Split')).toBe('Select the points to split off: drag over rows or press Space');
    });

    it('come back when they apply', () => {
        const { viewState } = setup();
        act(() => viewState().focusAnalysis(FACES.key, 1));
        act(() => viewState().togglePoint());
        act(() => viewState().toggleMerge(HOUSES.key));
        expect(enabled()).toContain('Move to…');
        expect(enabled()).toContain('Split');
        expect(enabled()).toContain('Merge');
    });

    it('a move needs a point focused or selected', () => {
        setup();
        expect(reasonOf('Move to…')).toBe('Focus a point, or select points: drag over rows or press Space');
    });

    it('a move needs another analysis to move to', () => {
        const view = renderWithStores(
            <ReviewScreen />,
            coordinateBundle({ coordinate_parse: { analyses: [FACES] } as ReviewBundle['coordinate_parse'] }),
            { now: () => 'now' }
        );
        act(() => view.stores.view.getState().focusAnalysis(FACES.key, 0));
        expect(reasonOf('Move to…')).toBe('There is no other analysis to move points to');
    });

    it('a merge needs another analysis selected', () => {
        setup();
        expect(reasonOf('Merge')).toBe(
            'Merge joins whole analyses: Shift-click another analysis’s card; to put these points in another analysis, use Move to…'
        );
    });

    it('a split leaves at least one point unselected', () => {
        const { viewState } = setup();
        act(() => viewState().focusAnalysis(FACES.key, 0));
        act(() => viewState().togglePoint());
        act(() => viewState().focusAnalysis(FACES.key, 1));
        act(() => viewState().togglePoint());
        expect(viewState().coordinates?.selected).toEqual([0, 1]);
        expect(button('Split')).toBeDisabled();
        expect(reasonOf('Split')).toBe('Leave at least one point unselected to split');
    });

    it('every action needs an analysis focused, not one the parse no longer has', () => {
        const { stores } = setup();
        act(() => stores.view.setState({ coordinates: { analysis: 'analysis#gone', point: null, selected: [] } }));
        expect(actions()).toEqual([]);
        act(() => void fireEvent.keyDown(document.body, { key: ';' }));
        expect(stores.view.getState().panel).toBeNull();
    });

    it('a text analysis has no table for C to add an analysis to', () => {
        const { viewState } = setup();
        act(() => viewState().focusAnalysis(LOCALIZER.key));
        act(() => void fireEvent.keyDown(document.body, { key: 'c' }));
        expect(viewState().panel).toBeNull();
        act(() => viewState().focusAnalysis(FACES.key));
        act(() => void fireEvent.keyDown(document.body, { key: 'c' }));
        expect(viewState().panel).toMatchObject({ kind: 'add_analysis', table: FACES.table_id });
    });

    it('an analysis with no points has none to edit', () => {
        const { viewState } = setup();
        act(() => viewState().toggleNonCoordinate());
        act(() => viewState().focusAnalysis(SCRAMBLED.key));
        expect(button('Edit point')).toBeDisabled();
        expect(reasonOf('Edit point')).toBe('This analysis has no points yet: add a row in its grid');
    });

    it('apply while a change to the analysis saves, as they do without it', () => {
        const { stores } = setup();
        const before = enabled();
        const relabel: Op = {
            client_op_id: 'c-pending',
            type: 'coordinate',
            target: { kind: 'coordinate_analysis', analysis_key: FACES.key },
            action: 'relabel',
            role: 'anchor',
        };
        act(() => void stores.session.getState().emitBatch([relabel]));
        expect(enabled()).toEqual(before);
        expect(reasonOf('Accept')).toBe('accept the focused analysis (a)');
    });

    it('show their key in their hint when they apply', () => {
        setup();
        expect(reasonOf('Accept')).toBe('accept the focused analysis (a)');
    });
});

describe('the reasons written under the coordinate head', () => {
    it('lists two actions giving the same reason once each, and leaves no stale line when they change', () => {
        const view = renderWithStores(<AnalysisReasons />, coordinateBundle(), { now: () => 'now' });
        act(() => view.stores.view.setState({ coordinates: { analysis: 'analysis#gone', point: null, selected: [] } }));
        const lines = () =>
            within(screen.getByRole('list', { name: 'why some actions do not apply' }))
                .getAllByRole('listitem')
                .map((line) => line.textContent);
        expect(lines()).toEqual(['Focus an analysis first', 'Focus an analysis first']);
        act(() => view.stores.view.getState().focusAnalysis(FACES.key));
        expect(lines()).toEqual([
            'Select the points to split off: drag over rows or press Space',
            'Merge joins whole analyses: Shift-click another analysis’s card; to put these points in another analysis, use Move to…',
        ]);
    });
});

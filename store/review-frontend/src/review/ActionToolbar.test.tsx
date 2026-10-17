import { act, fireEvent, screen, within } from '@testing-library/react';
import type { ReviewBundle } from '../contract/generated/review-bundle';
import type { Op } from '../contract/generated/review-ops';
import { coordinateBundle, FACES, HOUSES, LOCALIZER, SCRAMBLED } from '../test/coordinates';
import { renderWithStores } from '../test/render';
import { ReviewScreen } from './ReviewScreen';

// Handsontable does not lay out in jsdom; these tests drive the package's stand-in, which runs its hooks as it does.
vi.mock('@handsontable/react-wrapper', () => import('@neurosynth/coordinate-table/testing'));
vi.mock('handsontable/registry', () => ({ registerAllModules: () => {} }));

vi.setConfig({ testTimeout: 15_000 });

function setup() {
    const view = renderWithStores(<ReviewScreen />, coordinateBundle(), { now: () => 'now' });
    return { ...view, viewState: () => view.stores.view.getState() };
}

const button = (name: string) =>
    within(screen.getByRole('toolbar', { name: 'coordinate actions' })).getByRole('button', { name });
const enabled = () =>
    within(screen.getByRole('toolbar', { name: 'coordinate actions' }))
        .getAllByRole('button')
        .filter((b) => !b.hasAttribute('disabled'))
        .map((b) => b.textContent);

async function reasonOf(name: string) {
    fireEvent.mouseOver(button(name).parentElement!);
    return (await screen.findByRole('tooltip')).textContent;
}

describe('coordinate actions that do not apply to the focus', () => {
    it('are disabled on an analysis with nothing selected: move, split and merge', () => {
        setup();
        expect(enabled()).toEqual([
            'Accept',
            'Reject',
            'Note',
            'Edit analysis',
            'Change role',
            'Edit point',
            'Add analysis',
        ]);
    });

    it('say why in a tooltip', async () => {
        setup();
        expect(await reasonOf('Split')).toBe('Select the points to split off with Space first');
    });

    it('come back when they apply', () => {
        const { viewState } = setup();
        act(() => viewState().focusAnalysis(FACES.key, 1));
        act(() => viewState().togglePoint());
        act(() => viewState().toggleMerge(HOUSES.key));
        expect(enabled()).toContain('Move');
        expect(enabled()).toContain('Split');
        expect(enabled()).toContain('Merge');
    });

    it('a move needs a point focused or selected', async () => {
        setup();
        expect(await reasonOf('Move')).toBe('Focus a point, or select points with Space, first');
    });

    it('a move needs another analysis to move to', async () => {
        const view = renderWithStores(
            <ReviewScreen />,
            coordinateBundle({ coordinate_parse: { analyses: [FACES] } as ReviewBundle['coordinate_parse'] }),
            { now: () => 'now' }
        );
        act(() => view.stores.view.getState().focusAnalysis(FACES.key, 0));
        expect(await reasonOf('Move')).toBe('There is no other analysis to move points to');
    });

    it('a merge needs another analysis selected', async () => {
        setup();
        expect(await reasonOf('Merge')).toBe('Shift-click another analysis to merge with this one');
    });

    it('a split leaves at least one point unselected', async () => {
        const { viewState } = setup();
        act(() => viewState().focusAnalysis(FACES.key, 0));
        act(() => viewState().togglePoint());
        act(() => viewState().focusAnalysis(FACES.key, 1));
        act(() => viewState().togglePoint());
        expect(viewState().coordinates?.selected).toEqual([0, 1]);
        expect(button('Split')).toBeDisabled();
        expect(await reasonOf('Split')).toBe('Leave at least one point unselected to split');
    });

    it('every action needs an analysis focused, not one the parse no longer has', async () => {
        const { stores } = setup();
        act(() => stores.view.setState({ coordinates: { analysis: 'analysis#gone', point: null, selected: [] } }));
        expect(enabled()).toEqual([]);
        expect(await reasonOf('Note')).toBe('Focus an analysis first');
    });

    it('a text analysis has no table to add an analysis to', async () => {
        const { viewState } = setup();
        act(() => viewState().focusAnalysis(LOCALIZER.key));
        expect(button('Add analysis')).toBeDisabled();
        expect(await reasonOf('Add analysis')).toBe(
            'A text analysis has no table: use Add an analysis below, from the selected text'
        );
    });

    it('an analysis with no points has none to edit', async () => {
        const { viewState } = setup();
        act(() => viewState().toggleNonCoordinate());
        act(() => viewState().focusAnalysis(SCRAMBLED.key));
        expect(button('Edit point')).toBeDisabled();
        expect(await reasonOf('Edit point')).toBe('This analysis has no points yet: add a row in its grid');
    });

    it('wait while a coordinate change saves', async () => {
        const { stores } = setup();
        const relabel: Op = {
            client_op_id: 'c-pending',
            type: 'coordinate',
            target: { kind: 'coordinate_analysis', analysis_key: FACES.key },
            action: 'relabel',
            role: 'anchor',
        };
        act(() => void stores.session.getState().emitBatch([relabel]));
        expect(enabled()).toEqual(['Note']);
        expect(await reasonOf('Accept')).toBe('Wait for the coordinate change to save');
    });

    it('show their key in the tooltip when they apply', async () => {
        setup();
        expect(await reasonOf('Accept')).toBe('accept the focused analysis (a)');
    });
});

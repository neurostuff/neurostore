import { act } from '@testing-library/react';
import { analysesBeside } from '../model/coordinates';
import { ReviewScreen } from '../review/ReviewScreen';
import { coordinateBundle, FACES, HOUSES } from '../test/coordinates';
import { renderWithStores } from '../test/render';

// Handsontable does not lay out in jsdom; these tests drive the package's stand-in, which runs its hooks as it does.
vi.mock('@handsontable/react-wrapper', () => import('@neurosynth/coordinate-table/testing'));
vi.mock('handsontable/registry', () => ({ registerAllModules: () => {} }));

vi.mock('../model/coordinates', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../model/coordinates')>();
    return { ...actual, analysesBeside: vi.fn(actual.analysesBeside) };
});

const placements = () => vi.mocked(analysesBeside).mock.calls.length;

beforeEach(() => {
    vi.mocked(analysesBeside).mockClear();
});

describe('the placement of analyses beside the text', () => {
    it('is worked out once, not for each aside, and again only when the text, parse or display setting changes', () => {
        const { stores } = renderWithStores(<ReviewScreen />, coordinateBundle(), { now: () => 'now' });
        expect(placements()).toBe(1);
        act(() => {
            stores.view.getState().focusAnalysis(HOUSES.key);
            stores.view.getState().focusAnalysis(FACES.key);
            stores.session.getState().setLifecycle('submitted');
        });
        expect(placements()).toBe(1);
        act(() => stores.view.getState().toggleNonCoordinate());
        expect(placements()).toBe(2);
    });
});

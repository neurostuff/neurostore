import { act } from '@testing-library/react';
import { analysesBeside } from '../model/coordinates';
import { ReviewScreen } from '../review/ReviewScreen';
import { coordinateBundle, FACES, HOUSES } from '../test/coordinates';
import { renderWithStore } from '../test/render';

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
        const { store } = renderWithStore(<ReviewScreen />, coordinateBundle(), { now: () => 'now' });
        expect(placements()).toBe(1);
        act(() => {
            store.getState().focusAnalysis(HOUSES.key);
            store.getState().focusAnalysis(FACES.key);
            store.getState().setLifecycle('submitted');
        });
        expect(placements()).toBe(1);
        act(() => store.getState().toggleNonCoordinate());
        expect(placements()).toBe(2);
    });
});

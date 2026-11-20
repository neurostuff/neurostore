import { act } from '@testing-library/react';
import { ReviewScreen } from '../review/ReviewScreen';
import { COORD_TEXT, coordinateBundle, HOUSES, PROSE_TEXT, proseBundle, SCRAMBLED } from '../test/coordinates';
import { renderWithStores } from '../test/render';
import { createReviewStores } from './reviewStores';

// Handsontable does not lay out in jsdom; these tests drive the package's stand-in, which runs its hooks as it does.
vi.mock('@handsontable/react-wrapper', () => import('@neurosynth/coordinate-table/testing'));
vi.mock('handsontable/registry', () => ({ registerAllModules: () => {} }));

vi.setConfig({ testTimeout: 15_000 });

const rowSpan = (text: string): [number, number] => [COORD_TEXT.indexOf(text), COORD_TEXT.indexOf(text) + text.length];
const revealed = (stores: ReturnType<typeof createReviewStores>) => stores.view.getState().reveal?.span;

describe('the coordinates step brings its analysis into view', () => {
    it('opens on the first analysis, revealing its table row', () => {
        const stores = createReviewStores(coordinateBundle());
        expect(revealed(stores)).toEqual(rowSpan('Precuneus\t4\t−60\t40\t5.1'));
    });

    it('scrolls the text there when the text opens, not to the top of the paper', () => {
        vi.spyOn(Range.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 400, 10, 10));
        const { container } = renderWithStores(<ReviewScreen />, coordinateBundle());
        expect(container.querySelector<HTMLElement>('[data-text-scroller]')!.scrollTop).toBe(400);
    });

    it('reveals an analysis with no span of its own at its table', () => {
        const stores = createReviewStores(coordinateBundle());
        stores.view.getState().toggleNonCoordinate();
        stores.view.getState().focusAnalysis(SCRAMBLED.key);
        expect(revealed(stores)?.[0]).toBe(COORD_TEXT.indexOf('Contrast\tresult'));
    });

    it('reveals an analysis the text cannot place at the end, where its card is', () => {
        const stores = createReviewStores(proseBundle({ sets: false, nameSpans: false, coordinates: [1, 2, 3] }));
        expect(revealed(stores)).toEqual([PROSE_TEXT.length - 1, PROSE_TEXT.length]);
    });

    it('returning to the step brings back the analysis focused before, and reveals it', () => {
        const stores = createReviewStores(coordinateBundle());
        stores.view.getState().focusAnalysis(HOUSES.key);
        stores.view.getState().setStep('analyses');
        act(() => stores.view.getState().revealSpan([0, 1]));
        stores.view.getState().setStep('coordinates');
        expect(stores.view.getState().coordinates?.analysis).toBe(HOUSES.key);
        expect(revealed(stores)).toEqual(rowSpan('Cuneus\t10\t-80\t12\t3.3'));
    });
});

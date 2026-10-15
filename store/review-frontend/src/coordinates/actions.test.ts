import { createReviewStore } from '../store/reviewStore';
import { coordinateBundle, FACES } from '../test/coordinates';
import { relabelAnalysis } from './actions';

describe('relabelAnalysis', () => {
    it('sends nothing for the role the analysis already has, and a relabel for another', () => {
        const store = createReviewStore(coordinateBundle(), { now: () => 'now' });
        store.getState().focusAnalysis(FACES.key);
        expect(relabelAnalysis(store.getState(), 'result')).toBe(false);
        expect(store.getState().pending).toEqual([]);
        expect(relabelAnalysis(store.getState(), 'anchor')).toBe(true);
        expect(store.getState().pending).toEqual([
            expect.objectContaining({
                action: 'relabel',
                role: 'anchor',
                target: { kind: 'coordinate_analysis', analysis_key: FACES.key },
            }),
        ]);
    });
});

import { createReviewStores } from '../store/context';
import { coordinateBundle, FACES } from '../test/coordinates';
import { relabelAnalysis } from './actions';

describe('relabelAnalysis', () => {
    it('sends nothing for the role the analysis already has, and a relabel for another', () => {
        const store = createReviewStores(coordinateBundle(), { now: () => 'now' });
        store.view.getState().focusAnalysis(FACES.key);
        expect(relabelAnalysis(store, 'result')).toBe(false);
        expect(store.session.getState().pending).toEqual([]);
        expect(relabelAnalysis(store, 'anchor')).toBe(true);
        expect(store.session.getState().pending).toEqual([
            expect.objectContaining({
                action: 'relabel',
                role: 'anchor',
                target: { kind: 'coordinate_analysis', analysis_key: FACES.key },
            }),
        ]);
    });
});

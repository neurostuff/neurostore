import { act, fireEvent, screen } from '@testing-library/react';
import { takeHeldKeys } from '@neurosynth/coordinate-table/static';
import { ReviewScreen } from '../review/ReviewScreen';
import { coordinateBundle, FACES } from '../test/coordinates';
import { staticTable } from '../test/grid';
import { renderWithStores } from '../test/render';

vi.mock('./PointsTable', () => {
    throw new Error('the grid’s chunk did not load');
});

describe('a grid whose chunk did not load', () => {
    it('lets go of the keys typed on the static table, and j moves at once', async () => {
        const { stores } = renderWithStores(<ReviewScreen />, coordinateBundle(), { now: () => 'now' });
        act(() => {
            fireEvent.keyDown(staticTable(FACES.name), { key: '-' });
            fireEvent.keyDown(document.body, { key: '7' });
        });
        expect(await screen.findByRole('alert')).toHaveTextContent('The point grid did not load');
        expect(takeHeldKeys()).toEqual([]);
        act(() => void fireEvent.keyDown(document.body, { key: 'j' }));
        expect(stores.view.getState().coordinates).toMatchObject({ analysis: FACES.key, point: 0 });
    });
});

import { act, screen, waitFor } from '@testing-library/react';
import { fakeHotIn } from '@neurosynth/coordinate-table/testing';
import type { Op } from '../contract/generated/review-ops';
import { currentAnalyses } from '../model/coordinates';
import { ReviewScreen } from '../review/ReviewScreen';
import { createOpClient, type OpClient } from '../store/opClient';
import { coordinateBundle, FACES, INSULA, PRECUNEUS } from '../test/coordinates';
import { fakeServer } from '../test/fakeServer';
import { engageGrid } from '../test/grid';
import { renderWithStores } from '../test/render';

// Handsontable does not lay out in jsdom; these tests drive the package's stand-in, which runs its hooks as it does.
vi.mock('@handsontable/react-wrapper', () => import('@neurosynth/coordinate-table/testing'));
vi.mock('handsontable/registry', () => ({ registerAllModules: () => {} }));

vi.setConfig({ testTimeout: 30_000 });

let client: OpClient | undefined;
afterEach(() => client?.stop());

const SLOW = { timeout: 10_000 };

async function open() {
    const server = fakeServer([coordinateBundle({ review: null })]);
    await server.backend.startReview('P1');
    const view = renderWithStores(<ReviewScreen />, await server.backend.getBundle('P1'), { now: () => 'now' });
    client = createOpClient(view.stores.session, server.api());
    client.start();
    const grid = () => screen.getByRole('group', { name: `edit the points of ${FACES.name}` });
    await engageGrid(FACES.name);
    const saved = () => waitFor(() => expect(view.stores.session.getState().pending).toEqual([]), SLOW);
    const posted = () => server.requests.filter((r) => r.method === 'POST').map((r) => (r.body as { ops: Op[] }).ops);
    const points = () =>
        currentAnalyses(view.stores.session.getState().bundle).find((a) => a.name === FACES.name)?.points;
    return { ...view, server, grid, saved, posted, points };
}

describe('the point grid through the test server', () => {
    it('sends each committed edit and paste as one edit_points, and one undo reverts the last', async () => {
        const { grid, saved, posted, points, server, stores } = await open();
        act(() => fakeHotIn(grid()).edit(0, 'z', 42));
        await saved();
        act(() => fakeHotIn(grid()).edit(1, 'x', -30));
        await saved();
        act(() =>
            fakeHotIn(grid()).paste(2, 0, [
                ['1', '2', '3'],
                ['4', '5', '6'],
                ['7', '8', '9'],
            ])
        );
        await saved();
        const edited = [
            { ...PRECUNEUS, coordinates: [4, -60, 42] },
            { ...INSULA, coordinates: [-30, 20, 2] },
        ];
        expect(posted().map((ops) => ops.map((op) => [op.type, 'action' in op && op.action]))).toEqual([
            [['coordinate', 'edit_points']],
            [['coordinate', 'edit_points']],
            [['coordinate', 'edit_points']],
        ]);
        expect(posted().map(([op]) => (op as { payload: { points: unknown[] } }).payload.points)).toEqual([
            [edited[0], INSULA],
            edited,
            [...edited, { coordinates: [1, 2, 3] }, { coordinates: [4, 5, 6] }, { coordinates: [7, 8, 9] }],
        ]);
        expect(points()).toHaveLength(5);
        act(() => stores.session.getState().undo());
        await saved();
        expect(
            posted()
                .at(-1)
                ?.map((op) => [op.type, 'action' in op && op.action])
        ).toEqual([['coordinate', 'restore']]);
        expect(points()).toEqual(edited);
        expect(
            screen.getByRole('group', { name: `edit the points of ${FACES.name}` }).querySelectorAll('tbody tr')
        ).toHaveLength(2);
        expect(server.invalid()).toEqual([]);
    });
});

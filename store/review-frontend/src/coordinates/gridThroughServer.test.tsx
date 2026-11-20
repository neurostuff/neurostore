import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { fakeHotIn } from '@neurosynth/coordinate-table/testing';
import type { Op } from '../contract/generated/review-ops';
import { currentAnalyses } from '../model/coordinates';
import { ReviewScreen } from '../review/ReviewScreen';
import { createOpClient, type OpClient } from '../store/opClient';
import { coordinateBundle, FACES, HOUSES, INSULA, LOCALIZER, PRECUNEUS } from '../test/coordinates';
import { json } from '../test/fakeFetch';
import type { Interceptor } from '../test/fakeServer';
import type { SentRequest } from '../test/fakeFetch';
import { fakeServer } from '../test/fakeServer';
import { engageGrid, staticTable } from '../test/grid';
import { renderWithStores } from '../test/render';

// Handsontable does not lay out in jsdom; these tests drive the package's stand-in, which runs its hooks as it does.
vi.mock('@handsontable/react-wrapper', () => import('@neurosynth/coordinate-table/testing'));
vi.mock('handsontable/registry', () => ({ registerAllModules: () => {} }));

vi.setConfig({ testTimeout: 30_000 });

let client: OpClient | undefined;
afterEach(() => client?.stop());

const SLOW = { timeout: 10_000 };

async function open({ engaged = true } = {}) {
    const server = fakeServer([coordinateBundle({ review: null })]);
    await server.backend.startReview('P1');
    const view = renderWithStores(<ReviewScreen />, await server.backend.getBundle('P1'), { now: () => 'now' });
    client = createOpClient(view.stores.session, server.api());
    client.start();
    const grid = () => screen.getByRole('group', { name: `edit the points of ${FACES.name}` });
    if (engaged) await engageGrid(FACES.name);
    const saved = () =>
        waitFor(() => {
            expect(view.stores.session.getState().collected).toEqual([]);
            expect(view.stores.session.getState().pending).toEqual([]);
        }, SLOW);
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

    it('carries keys typed on the static table into its first grid only, never into a later Edit point', async () => {
        const { saved, posted, stores } = await open({ engaged: false });
        act(() => {
            fireEvent.keyDown(staticTable(FACES.name), { key: '-' });
            for (const key of ['7', 'Enter']) fireEvent.keyDown(document.body, { key });
        });
        await waitFor(() => expect(posted()).toHaveLength(1), SLOW);
        await saved();
        act(() => stores.view.getState().focusAnalysis(LOCALIZER.key));
        fireEvent.click(
            within(screen.getByRole('group', { name: /^actions on (point \d+|the points) of / })).getByRole('button', {
                name: 'Edit point',
            })
        );
        const grid = await screen.findByRole('group', { name: `edit the points of ${LOCALIZER.name}` });
        await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
        expect(fakeHotIn(grid).editor).toBeNull();
        expect(fakeHotIn(grid).selection).toEqual([0, 0, 0, 0]);
        expect(posted().map(([op]) => (op as { payload: { points: unknown[] } }).payload.points)).toEqual([
            [{ ...PRECUNEUS, coordinates: [-7, -60, 40] }, INSULA],
        ]);
    });
});

describe('a result that lands while the grid is hidden', () => {
    type Respond = (request: SentRequest) => Response | undefined;

    /** Holds back the next op batch until the returned function is called; `respond` answers it, else the server does. */
    function holdBatch(server: { intercept(interceptor: Interceptor): void }) {
        let release: (respond: Respond) => void = () => {};
        const released = new Promise<Respond>((resolve) => (release = resolve));
        const hold: Interceptor = async (request) => {
            if (request.method !== 'POST') {
                server.intercept(hold);
                return undefined;
            }
            return (await released)(request);
        };
        server.intercept(hold);
        return release;
    }

    const refuse: Respond = (request) => {
        const [op] = (request.body as { ops: Op[] }).ops;
        return json(
            {
                status: 422,
                title: 'Unprocessable Entity',
                detail: 'op 0 is refused',
                errors: [
                    {
                        field: 'ops/0',
                        code: 'REJECTED',
                        message: 'refused',
                        context: { op_index: 0, client_op_id: op.client_op_id },
                    },
                ],
            },
            422
        );
    };

    it.each<[string, Respond]>([
        ['confirmed', () => undefined],
        ['refused', refuse],
    ])('leaves the focus on the analysis shown when it is %s', async (_, respond) => {
        const { grid, server, stores } = await open();
        const release = holdBatch(server);
        act(() => fakeHotIn(grid()).edit(0, 'z', 42));
        act(() => stores.view.getState().focusAnalysis(HOUSES.key));
        release(respond);
        await waitFor(() => expect(stores.session.getState().pending).toEqual([]), SLOW);
        expect(stores.view.getState().coordinates).toEqual({ analysis: HOUSES.key, point: null, selected: [] });
        expect(screen.getByRole('group', { name: `${HOUSES.name}: card head` })).toBeInTheDocument();
    });
});

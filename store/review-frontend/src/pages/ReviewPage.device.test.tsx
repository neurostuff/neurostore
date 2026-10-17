import { ThemeProvider } from '@mui/material';
import { fireEvent, render, waitFor, within } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';
import type { Op } from '../contract/generated/review-ops';
import { openDeviceQueue, QUEUE_VERSION } from '../store/deviceQueue';
import { OTHER_TAB } from '../store/reviewSession';
import { ev, makeBundle } from '../test/bundles';
import { fakeLocks } from '../test/fakeLocks';
import { fakeServer, type FakeServer } from '../test/fakeServer';
import { theme } from '../theme';

const bundle = makeBundle({ description: ev('A study', [[0, 4]]) }, 'Text of the paper.', {
    source: { ...makeBundle({}, '').source, id: 'S1', label: 'A paper' },
});

const restoredValue: Op = {
    client_op_id: 'kept-0001',
    type: 'set_value',
    target: { kind: 'slot', entity: 'study', path: 'description' },
    value: { extraction_status: 'extracted', value: 'A restored study' },
};

const SLOW = { timeout: 15000 };

let server: FakeServer;

const posts = () => server.requests.filter((r) => r.method === 'POST');
const sentIds = () => posts().map((r) => (r.body as { ops: Op[] }).ops.map((op) => op.client_op_id));

function openPaper() {
    return render(
        <ThemeProvider theme={theme}>
            <MemoryRouter
                basename="/review"
                initialEntries={['/review/papers/S1']}
                future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
            >
                <AppRoutes api={server.api()} />
            </MemoryRouter>
        </ThemeProvider>
    );
}

/** Web Locks whose first request is answered only once `grant` is called. */
function gatedLocks() {
    const { locks } = fakeLocks();
    let grant = () => {};
    const granted = new Promise<void>((done) => (grant = done));
    const request = locks.request.bind(locks) as (...args: unknown[]) => Promise<unknown>;
    const gated = {
        request: async (...args: unknown[]) => {
            await granted;
            return request(...args);
        },
    } as unknown as LockManager;
    return { locks: gated, grant };
}

beforeEach(async () => {
    server = fakeServer([bundle]);
    const reviewId = (await server.backend.startReview('S1')).summary.id;
    const indexedDB = new IDBFactory();
    vi.stubGlobal('indexedDB', indexedDB);
    const queue = await openDeviceQueue(indexedDB, () => {});
    await queue.write({
        version: QUEUE_VERSION,
        review_id: reviewId,
        ops: [restoredValue],
        groupOf: {},
        intents: {},
        saved_at: new Date().toISOString(),
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'locks');
    expect(server.invalid()).toEqual([]);
});

const setLocks = (locks: LockManager) =>
    Object.defineProperty(navigator, 'locks', { configurable: true, value: locks });

describe('a review opened with edits kept on this device', () => {
    it('shows loading until they are restored, then shows and sends them once; a second tab is read-only', async () => {
        const { locks, grant } = gatedLocks();
        setLocks(locks);
        const first = openPaper();
        await waitFor(() => expect(server.requests.some((r) => r.path.endsWith('/bundle'))).toBe(true), SLOW);
        await new Promise((done) => setTimeout(done, 50));
        expect(within(first.container).getByLabelText('loading')).toBeInTheDocument();
        expect(within(first.container).queryByRole('banner')).not.toBeInTheDocument();
        grant();
        expect(await within(first.container).findByText('A restored study', {}, SLOW)).toBeInTheDocument();
        await waitFor(() => expect(sentIds()).toEqual([['kept-0001']]), SLOW);

        const second = openPaper();
        const tab = within(second.container);
        expect(await tab.findByRole('note', {}, SLOW)).toHaveTextContent(OTHER_TAB);
        const accept = within(tab.getByRole('toolbar', { name: 'review actions' })).getByRole('button', {
            name: 'Accept',
        });
        expect(accept).toBeDisabled();
        fireEvent.click(accept);
        await new Promise((done) => setTimeout(done, 1500));
        expect(sentIds()).toEqual([['kept-0001']]);
        first.unmount();
        second.unmount();
    }, 30_000);
});

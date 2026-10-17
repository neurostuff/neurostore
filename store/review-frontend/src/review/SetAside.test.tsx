import { ThemeProvider } from '@mui/material';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OpClientProvider, ReviewStoresProvider } from '../store/context';
import { createReviewStores, type ReviewStores } from '../store/reviewStores';
import { createOpClient, type OpClient } from '../store/opClient';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { fakeServer, type FakeServer } from '../test/fakeServer';
import { theme } from '../theme';
import { ReviewScreen } from './ReviewScreen';

const bundle = makeBundle({ groups: [{ local_id: 'grp_a', name: ev('Patients') }] }, 'Some text.', {
    source: { ...makeBundle({}, '').source, id: 'S1', label: 'A paper' },
    entities: entityRows(row('grp_a', 'Group', 'groups')),
});
const SLOW = { timeout: 15000 };

let server: FakeServer;
let client: OpClient | undefined;

beforeEach(() => {
    server = fakeServer([bundle]);
});

afterEach(() => {
    client?.stop();
    client = undefined;
    expect(server.invalid()).toEqual([]);
});

async function renderScreen(): Promise<ReviewStores> {
    await server.backend.startReview('S1');
    const store = createReviewStores(await server.backend.getBundle('S1'));
    client = createOpClient(store.session, server.api());
    client.start();
    render(
        <ThemeProvider theme={theme}>
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <ReviewStoresProvider stores={store}>
                    <OpClientProvider client={client}>
                        <ReviewScreen />
                    </OpClientProvider>
                </ReviewStoresProvider>
            </MemoryRouter>
        </ThemeProvider>
    );
    return store;
}

const patches = () => server.requests.filter((r) => r.method === 'PATCH').map((r) => r.body);

describe('setting a paper aside', () => {
    it('sets the paper aside from any step with a reason and a note, and resumes it', async () => {
        const store = await renderScreen();
        act(() => store.view.getState().setStep('leftovers'));
        fireEvent.click(screen.getByRole('button', { name: 'Set aside' }));
        const dialog = screen.getByRole('dialog', { name: 'Set this paper aside' });
        fireEvent.click(within(dialog).getByRole('radio', { name: 'duplicate of another paper' }));
        fireEvent.change(within(dialog).getByRole('textbox', { name: 'note' }), { target: { value: 'same as P2' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Set aside' }));

        const banner = await screen.findByRole('status', { name: 'set aside' }, SLOW);
        expect(banner).toHaveTextContent('Set aside: duplicate of another paper. same as P2');
        expect(patches()).toEqual([{ state: 'set_aside', reason: 'duplicate', note: 'same as P2' }]);
        expect(screen.queryByRole('button', { name: 'Set aside' })).not.toBeInTheDocument();
        expect(store.session.getState().bundle.review?.state).toBe('set_aside');
        expect(store.view.getState().step).toBe('leftovers');

        fireEvent.click(within(banner).getByRole('button', { name: 'Resume' }));
        await waitFor(() => expect(store.session.getState().bundle.review?.state).toBe('in_progress'), SLOW);
        expect(screen.queryByRole('status', { name: 'set aside' })).not.toBeInTheDocument();
        expect(patches().at(-1)).toEqual({ state: 'in_progress' });
    }, 30_000);

    it('asks for a note with “other”', async () => {
        await renderScreen();
        fireEvent.click(screen.getByRole('button', { name: 'Set aside' }));
        const dialog = screen.getByRole('dialog', { name: 'Set this paper aside' });
        fireEvent.click(within(dialog).getByRole('radio', { name: 'other' }));
        fireEvent.click(within(dialog).getByRole('button', { name: 'Set aside' }));
        expect(within(dialog).getByRole('textbox', { name: 'note' })).toHaveAccessibleDescription(
            'a note is required with “other”'
        );
        expect(patches()).toEqual([]);
    });

    it('sends nothing until a reason is picked', async () => {
        const store = await renderScreen();
        fireEvent.click(screen.getByRole('button', { name: 'Set aside' }));
        const dialog = screen.getByRole('dialog', { name: 'Set this paper aside' });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Set aside' }));
        expect(within(dialog).getByRole('alert')).toHaveTextContent('pick a reason');
        expect(patches()).toEqual([]);
        expect(store.session.getState().bundle.review?.state).toBe('in_progress');
    });
});

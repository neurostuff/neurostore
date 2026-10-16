import { ThemeProvider } from '@mui/material';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { fakeServer, type FakeServer } from '../test/fakeServer';
import { json } from '../test/fakeFetch';
import { createReviewStores, OpClientProvider, type ReviewStores, ReviewStoresProvider } from '../store/context';
import { createOpClient, type OpClient } from '../store/opClient';
import { slotKey } from '../model/targetKey';
import { theme } from '../theme';
import { ReviewScreen } from './ReviewScreen';

const TEXT = 'Twenty patients performed a Stroop task during fMRI scanning.';
const at = (words: string): [number, number] => [TEXT.indexOf(words), TEXT.indexOf(words) + words.length];
const bundle = makeBundle({ groups: [{ local_id: 'grp_a', name: ev('Patients'), age_mean: ev(31) }] }, TEXT, {
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

describe('a save the server refuses without naming an op', () => {
    it('shows the error and the pending edit, focuses the slot its message is about, and resumes once undone', async () => {
        server.intercept(() =>
            json(
                {
                    status: 422,
                    title: 'Unprocessable Entity',
                    detail: 'op 1 leaves an invalid document',
                    errors: [
                        {
                            field: 'ops/1',
                            code: 'REJECTED',
                            message:
                                "extraction-record /groups/0/age_mean/value: 'old' is not of type 'number', 'null'",
                        },
                    ],
                },
                422
            )
        );
        const store = await renderScreen();
        act(() => store.view.getState().focusSlot(slotKey('grp_a', 'age_mean')));
        act(() => store.session.getState().addEvidence(store.view.getState().focus.key, at('Stroop'), 'new'));

        const alert = await screen.findByRole('alert', {}, SLOW);
        expect(screen.getByLabelText(/^save state/)).toHaveTextContent('op 1 leaves an invalid document');
        expect(alert).toHaveTextContent("'old' is not of type 'number', 'null'");
        expect(alert).toHaveTextContent('Pending edits (1)');
        expect(alert).toHaveTextContent('set_evidence: Patients · age_mean');

        act(() => store.view.getState().focusEntity('grp_a'));
        fireEvent.click(within(alert).getByRole('button', { name: 'Patients · age_mean' }));
        expect(store.view.getState().focus.key).toBe(slotKey('grp_a', 'age_mean'));

        fireEvent.click(within(alert).getByRole('button', { name: 'Undo the edits that caused it' }));
        await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument(), SLOW);
        expect(store.session.getState().pending).toEqual([]);
        expect(store.session.getState().index.slot(slotKey('grp_a', 'age_mean'))?.spans).toEqual([]);
        expect(screen.getByLabelText(/^save state/).textContent).toBe('saved');

        act(() => store.view.getState().focusSlot(slotKey('grp_a', 'age_mean')));
        let added = false;
        act(() => {
            added = store.session.getState().addEvidence(store.view.getState().focus.key, at('fMRI'), 'new');
        });
        expect(added).toBe(true);
        await waitFor(() => expect(screen.getByLabelText(/^save state/).textContent).toBe('saved'), SLOW);
        expect(server.requests.filter((r) => r.method === 'POST')).toHaveLength(2);
        expect(store.session.getState().index.slot(slotKey('grp_a', 'age_mean'))?.spans).toEqual([
            [at('fMRI')[0], at('fMRI')[1]],
        ]);
    }, 30_000);
});

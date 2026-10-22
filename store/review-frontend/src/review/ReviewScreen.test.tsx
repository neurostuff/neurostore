import { ThemeProvider } from '@mui/material';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { entityRows, ev, makeBundle, row } from '../test/bundles';
import { fakeServer, type FakeServer } from '../test/fakeServer';
import { json } from '../test/fakeFetch';
import { OpClientProvider, ReviewStoresProvider } from '../store/context';
import { createReviewStores, type ReviewStores } from '../store/reviewStores';
import { createOpClient, type OpClient } from '../store/opClient';
import { slotKey } from '../model/targetKey';
import { openPanelOn } from '../inspector/openPanel';
import { OTHER_TAB } from '../store/reviewSession';
import { selectCanUndo } from '../store/sessionStore';
import { theme } from '../theme';
import { ReviewScreen } from './ReviewScreen';
import { writeShare } from './paneShare';
import { newSet } from '../test/stores';

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
        act(() =>
            store.session
                .getState()
                .addEvidence(
                    store.view.getState().focus.key,
                    at('Stroop'),
                    newSet(store.session.getState(), store.view.getState().focus.key)
                )
        );

        const alert = await screen.findByRole('alert', {}, SLOW);
        expect(screen.getByLabelText(/^save state/)).toHaveAccessibleName(/op 1 leaves an invalid document/);
        expect(alert).toHaveTextContent("'old' is not of type 'number', 'null'");
        expect(alert).toHaveTextContent('Pending edits (1)');
        expect(alert).toHaveTextContent('set_evidence: Patients · Age mean');

        act(() => store.view.getState().focusEntity('grp_a'));
        fireEvent.click(within(alert).getByRole('button', { name: 'Patients · Age mean' }));
        expect(store.view.getState().focus.key).toBe(slotKey('grp_a', 'age_mean'));

        fireEvent.click(within(alert).getByRole('button', { name: 'Undo the edits that caused it' }));
        await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument(), SLOW);
        expect(store.session.getState().pending).toEqual([]);
        expect(store.session.getState().index.slot(slotKey('grp_a', 'age_mean'))?.spans).toEqual([]);
        expect(screen.getByLabelText(/^save state/)).toHaveAccessibleName('save state: saved');

        act(() => store.view.getState().focusSlot(slotKey('grp_a', 'age_mean')));
        let added = false;
        act(() => {
            added = store.session
                .getState()
                .addEvidence(
                    store.view.getState().focus.key,
                    at('fMRI'),
                    newSet(store.session.getState(), store.view.getState().focus.key)
                );
        });
        expect(added).toBe(true);
        await waitFor(
            () => expect(screen.getByLabelText(/^save state/)).toHaveAccessibleName('save state: saved'),
            SLOW
        );
        expect(server.requests.filter((r) => r.method === 'POST')).toHaveLength(2);
        expect(store.session.getState().index.slot(slotKey('grp_a', 'age_mean'))?.spans).toEqual([
            [at('fMRI')[0], at('fMRI')[1]],
        ]);
    }, 30_000);
});

describe('a tab another one holds the review in', () => {
    it('disables its actions, opens no editor, takes no undo, and keeps the note', async () => {
        const store = await renderScreen();
        act(() => store.session.getState().setDevice('readonly', OTHER_TAB));
        act(() => store.view.getState().focusSlot(slotKey('grp_a', 'age_mean')));
        act(() => openPanelOn(store, 'edit'));
        expect(screen.getByText(OTHER_TAB).closest('[role="note"]')).not.toBeNull();
        const actions = within(screen.getByRole('complementary', { name: 'review' }))
            .getAllByRole('button')
            .filter((button) => button.hasAttribute('aria-keyshortcuts'));
        expect(actions.length).toBeGreaterThan(0);
        actions.forEach((button) => expect(button).toBeDisabled());
        expect(store.view.getState().panel).toBeNull();
        fireEvent.keyDown(window, { key: 'Enter' });
        expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
        expect(selectCanUndo(store.session.getState())).toBe(false);
        fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
        expect(store.session.getState().pending).toEqual([]);
    });
});

describe('the divider between the text and the inspector', () => {
    beforeEach(() => localStorage.clear());

    it('sits between them, with the share the reviewer left it at', async () => {
        const store = await renderScreen();
        const viewer = store.session.getState().bundle.review!.user_id;
        client?.stop();
        cleanup();
        writeShare(viewer, 45);
        await renderScreen();
        const divider = screen.getByRole('separator', { name: 'Resize the text and the review panes' });
        expect(divider.previousElementSibling).toBe(screen.getByRole('main'));
        expect(divider.nextElementSibling).toBe(screen.getByRole('complementary', { name: 'review' }));
        expect(divider).toHaveAttribute('aria-valuenow', '45');
    });
});

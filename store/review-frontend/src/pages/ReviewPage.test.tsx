import { ThemeProvider } from '@mui/material';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';
import { ev, makeBundle } from '../test/bundles';
import { fakeServer, type FakeServer } from '../test/fakeServer';
import { theme } from '../theme';

const bundle = makeBundle({ description: ev('A study', [[0, 4]]) }, 'Text of the paper.', {
    source: { ...makeBundle({}, '').source, id: 'S1', label: 'A paper' },
});

let server: FakeServer;

beforeEach(() => {
    server = fakeServer([bundle]);
});

afterEach(() => expect(server.invalid()).toEqual([]));

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

const SLOW = { timeout: 15000 };
const findState = (state: string) => screen.findByLabelText(`review state: ${state}`, {}, SLOW);

const calls = () => server.requests.map((r) => `${r.method} ${r.path}`);

describe('opening a paper', () => {
    it('starts the caller’s review when the bundle has none, then refetches the bundle', async () => {
        openPaper();
        expect(await findState('in progress')).toBeInTheDocument();
        expect(calls()).toEqual([
            'GET /api/review/sources/S1/bundle',
            'PUT /api/review/sources/S1/review',
            'GET /api/review/sources/S1/bundle',
        ]);
    });

    it('does not start another review when the caller has one', async () => {
        await server.backend.startReview('S1');
        openPaper();
        expect(await findState('in progress')).toBeInTheDocument();
        expect(calls()).toEqual(['GET /api/review/sources/S1/bundle']);
    });
});

describe('the submit step', () => {
    it('submits the review, and reopens a submitted one', async () => {
        openPaper();
        await findState('in progress');
        fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Submit review' }, SLOW));
        expect(await findState('submitted')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Reopen review' }));
        expect(await findState('in progress')).toBeInTheDocument();
        const patches = server.requests.filter((r) => r.method === 'PATCH').map((r) => r.body);
        expect(patches).toEqual([{ state: 'submitted' }, { state: 'in_progress' }]);
        await waitFor(() => expect(screen.getByRole('button', { name: 'Submit review' })).toBeEnabled(), SLOW);
    }, 30_000);
});

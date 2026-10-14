import { ThemeProvider } from '@mui/material';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReviewApi } from './api/reviewApi';
import { App, AppRoutes } from './App';
import { ev, makeBundle } from './test/bundles';
import { theme } from './theme';

const paper = (id: string, label: string, text: string) =>
    makeBundle({ description: ev('A study', [[0, 5]]) }, text, {
        source: { ...makeBundle({}, '').source, id, label },
    });

const bundles = {
    P1: paper('P1', 'First paper', 'Text of the first paper.'),
    P2: paper('P2', 'Second paper', 'Hello, reviewer.'),
};

const api: ReviewApi = {
    listPapers: async () => [
        { id: 'P1', label: 'First paper' },
        { id: 'P2', label: 'Second paper' },
    ],
    getBundle: async (id) => {
        if (!(id in bundles)) throw new Error(`no bundle ${id}`);
        return bundles[id as keyof typeof bundles];
    },
};

function renderAt(path: string) {
    return render(
        <ThemeProvider theme={theme}>
            <MemoryRouter
                basename="/review"
                initialEntries={[path]}
                future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
            >
                <AppRoutes api={api} />
            </MemoryRouter>
        </ThemeProvider>
    );
}

describe('routes', () => {
    it('/review lists the papers, each linking to its review', async () => {
        renderAt('/review');
        const link = await screen.findByRole('link', { name: /^Second paper/ });
        expect(link).toHaveAttribute('href', '/review/papers/P2');
        expect(screen.getByRole('link', { name: /^First paper/ })).toHaveAttribute('href', '/review/papers/P1');
    });

    it('/review/papers/:id opens that paper from its bundle', async () => {
        renderAt('/review/papers/P2');
        expect(await screen.findByText('Hello, reviewer.')).toBeInTheDocument();
        expect(screen.getByRole('banner')).toHaveTextContent('Second paper');
    });

    it('opens the other paper’s bundle after going from one paper to another', async () => {
        renderAt('/review/papers/P2');
        await screen.findByText('Hello, reviewer.');
        fireEvent.click(screen.getByRole('link', { name: 'neurostore review' }));
        fireEvent.click(await screen.findByRole('link', { name: /^First paper/ }));
        expect(await screen.findByText('Text of the first paper.')).toBeInTheDocument();
        expect(screen.queryByText('Hello, reviewer.')).not.toBeInTheDocument();
        expect(screen.getByRole('banner')).toHaveTextContent('First paper');
    });

    it('says when a paper cannot be opened', async () => {
        renderAt('/review/papers/P9');
        expect(await screen.findByRole('alert')).toHaveTextContent('no bundle P9');
    });
});

describe('App', () => {
    afterEach(() => window.history.replaceState(null, '', '/'));

    it('routes the browser’s URL under the app’s /review/ base', async () => {
        window.history.replaceState(null, '', '/review/papers/P1');
        render(<App api={api} />);
        expect(await screen.findByText('Text of the first paper.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('link', { name: 'neurostore review' }));
        expect(window.location.pathname).toBe('/review');
        expect(await screen.findByRole('link', { name: /^Second paper/ })).toHaveAttribute('href', '/review/papers/P2');
    });
});

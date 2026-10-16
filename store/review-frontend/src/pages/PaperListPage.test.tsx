import { ThemeProvider } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ApiProvider, createQueryClient } from '../api/context';
import type { PaperSummary, ReviewApi } from '../api/reviewApi';
import { theme } from '../theme';
import { PaperListPage } from './PaperListPage';

const papers: PaperSummary[] = [
    {
        id: 'P1',
        label: 'First paper',
        total: 10,
        reviews: [
            { user_id: 'ana', user_name: 'Ana', state: 'submitted', edited: 4, verified: 6, reviewed: 8 },
            { user_id: 'ben', user_name: null, state: 'in_progress', edited: 1, verified: 0, reviewed: 1 },
        ],
    },
    { id: 'P2', label: 'Second paper', total: 0, reviews: [] },
    {
        id: 'P3',
        label: 'Third paper',
        total: 0,
        reviews: [{ user_id: 'ana', user_name: 'Ana', state: 'in_progress', edited: 0, verified: 0, reviewed: 0 }],
    },
];

function renderList(list: PaperSummary[] = papers) {
    const api = { listPapers: async () => list } as unknown as ReviewApi;
    return render(
        <ThemeProvider theme={theme}>
            <QueryClientProvider client={createQueryClient()}>
                <ApiProvider api={api}>
                    <MemoryRouter>
                        <PaperListPage />
                    </MemoryRouter>
                </ApiProvider>
            </QueryClientProvider>
        </ThemeProvider>
    );
}

describe('the paper list', () => {
    it('shows each reviewer’s state and counts under the paper', async () => {
        renderList();
        const row = await screen.findByRole('link', { name: /First paper/ });
        expect(within(row).getByText('Ana: submitted, 4 edited, 6 verified, 80% reviewed')).toBeInTheDocument();
        expect(within(row).getByText('ben: in progress, 1 edited, 0 verified, 10% reviewed')).toBeInTheDocument();
    });

    it('shows each reviewer’s reviewed share of the paper’s judgeable items, or a dash when there are none', async () => {
        renderList();
        const first = await screen.findByRole('link', { name: /First paper/ });
        expect(within(first).getByText('Ana: submitted, 4 edited, 6 verified, 80% reviewed')).toBeInTheDocument();
        expect(within(first).getByText('ben: in progress, 1 edited, 0 verified, 10% reviewed')).toBeInTheDocument();
        const third = await screen.findByRole('link', { name: /Third paper/ });
        expect(within(third).getByText('Ana: in progress, 0 edited, 0 verified, — reviewed')).toBeInTheDocument();
    });

    it('says when no one has started a paper', async () => {
        renderList();
        const row = await screen.findByRole('link', { name: /Second paper/ });
        expect(within(row).getByText('not started')).toBeInTheDocument();
    });

    it('rounds the reviewed share to a whole percent', async () => {
        renderList([
            {
                id: 'P4',
                label: 'Fourth paper',
                total: 3,
                reviews: [{ user_id: 'ana', user_name: 'Ana', state: 'in_progress', edited: 0, verified: 2, reviewed: 2 }],
            },
        ]);
        const row = await screen.findByRole('link', { name: /Fourth paper/ });
        expect(within(row).getByText('Ana: in progress, 0 edited, 2 verified, 67% reviewed')).toBeInTheDocument();
    });

    it('shows a set-aside review as set aside, with its reason, so it can be found and resumed', async () => {
        renderList([
            {
                id: 'P5',
                label: 'Fifth paper',
                total: 4,
                reviews: [
                    {
                        user_id: 'ana',
                        user_name: 'Ana',
                        state: 'set_aside',
                        set_aside: { reason: 'no_usable_text', note: null },
                        edited: 0,
                        verified: 1,
                        reviewed: 1,
                    },
                ],
            },
        ]);
        const row = await screen.findByRole('link', { name: /Fifth paper/ });
        expect(row).toHaveAttribute('href', '/papers/P5');
        expect(
            within(row).getByText('Ana: set aside (no usable text), 0 edited, 1 verified, 25% reviewed')
        ).toBeInTheDocument();
    });
});

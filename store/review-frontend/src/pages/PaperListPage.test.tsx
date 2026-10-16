import { ThemeProvider } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ApiProvider, createQueryClient } from '../api/context';
import type { PaperSummary, ReviewApi } from '../api/reviewApi';
import { theme } from '../theme';
import { PaperListPage } from './PaperListPage';

const papers: PaperSummary[] = [
    {
        id: 'P1',
        base_study_id: 'B-P1',
        label: 'First paper',
        total: 10,
        reviews: [
            {
                user_id: 'ana',
                user_name: 'Ana',
                state: 'submitted',
                edited: 4,
                verified: 6,
                reviewed: 8,
                op_count: 0,
                last_edit_at: null,
            },
            {
                user_id: 'ben',
                user_name: null,
                state: 'in_progress',
                edited: 1,
                verified: 0,
                reviewed: 1,
                op_count: 0,
                last_edit_at: null,
            },
        ],
    },
    { id: 'P2', base_study_id: 'B-P2', label: 'Second paper', total: 0, reviews: [] },
    {
        id: 'P3',
        base_study_id: 'B-P3',
        label: 'Third paper',
        total: 0,
        reviews: [
            {
                user_id: 'ana',
                user_name: 'Ana',
                state: 'in_progress',
                edited: 0,
                verified: 0,
                reviewed: 0,
                op_count: 0,
                last_edit_at: null,
            },
        ],
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
                base_study_id: 'B-P4',
                label: 'Fourth paper',
                total: 3,
                reviews: [
                    {
                        user_id: 'ana',
                        user_name: 'Ana',
                        state: 'in_progress',
                        edited: 0,
                        verified: 2,
                        reviewed: 2,
                        op_count: 0,
                        last_edit_at: null,
                    },
                ],
            },
        ]);
        const row = await screen.findByRole('link', { name: /Fourth paper/ });
        expect(within(row).getByText('Ana: in progress, 0 edited, 2 verified, 67% reviewed')).toBeInTheDocument();
    });

    it('shows a set-aside review as set aside, with its reason, so it can be found and resumed', async () => {
        renderList([
            {
                id: 'P5',
                base_study_id: 'B-P5',
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
                        op_count: 0,
                        last_edit_at: null,
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

const me = { user_id: 'ana', name: 'Ana', lead: false };
const reviewers = [
    { user_id: 'ana', name: 'Ana' },
    { user_id: 'ben', name: 'Ben' },
];

const assigned = (assignees: { user_id: string; name: string | null }[]): PaperSummary => ({
    id: 'P6',
    base_study_id: 'B-P6',
    label: 'Sixth paper',
    total: 0,
    assignees,
    reviews: [],
});

function renderPapers(api: Partial<ReviewApi>) {
    const full = {
        listPapers: async () => [],
        getMe: async () => me,
        listReviewers: async () => reviewers,
        assign: async () => {},
        release: async () => {},
        ...api,
    } as unknown as ReviewApi;
    return render(
        <ThemeProvider theme={theme}>
            <QueryClientProvider client={createQueryClient()}>
                <ApiProvider api={full}>
                    <MemoryRouter>
                        <PaperListPage />
                    </MemoryRouter>
                </ApiProvider>
            </QueryClientProvider>
        </ThemeProvider>
    );
}

describe('assignments in the paper list', () => {
    it('shows who a paper is assigned to, and assigns it to the caller with “Assign me”', async () => {
        const assign = vi.fn(async () => {});
        renderPapers({ listPapers: async () => [assigned([{ user_id: 'ben', name: 'Ben' }])], assign });
        const row = await screen.findByRole('link', { name: /Sixth paper/ });
        expect(within(row).getByText('Assigned to Ben')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Assign me' }));
        expect(assign).toHaveBeenCalledWith('B-P6', 'ana');
    });

    it('releases the caller’s own assignment with “Release”', async () => {
        const release = vi.fn(async () => {});
        renderPapers({ listPapers: async () => [assigned([{ user_id: 'ana', name: 'Ana' }])], release });
        expect(await screen.findByRole('button', { name: 'Assign me' })).toBeDisabled();
        await userEvent.click(screen.getByRole('button', { name: 'Release' }));
        expect(release).toHaveBeenCalledWith('B-P6', 'ana');
    });

    it('says a paper with no assignee is unassigned', async () => {
        renderPapers({ listPapers: async () => [assigned([])] });
        const row = await screen.findByRole('link', { name: /Sixth paper/ });
        expect(within(row).getByText('Unassigned')).toBeInTheDocument();
    });

    it('gives a reviewer no picker of other reviewers', async () => {
        renderPapers({ listPapers: async () => [assigned([])] });
        await screen.findByRole('link', { name: /Sixth paper/ });
        expect(screen.queryByRole('combobox', { name: 'Assign Sixth paper to' })).not.toBeInTheDocument();
    });

    it('lets a lead reviewer assign a paper to any admin-reviewer through the picker, and release anyone', async () => {
        const assign = vi.fn(async () => {});
        const release = vi.fn(async () => {});
        renderPapers({
            listPapers: async () => [assigned([{ user_id: 'ben', name: 'Ben' }])],
            getMe: async () => ({ ...me, lead: true }),
            assign,
            release,
        });
        await screen.findByRole('link', { name: /Sixth paper/ });
        await userEvent.click(screen.getByRole('combobox', { name: 'Assign Sixth paper to' }));
        await userEvent.click(await screen.findByRole('option', { name: 'Ben' }));
        expect(assign).toHaveBeenCalledWith('B-P6', 'ben');
        await userEvent.click(screen.getByRole('button', { name: 'Release Ben' }));
        expect(release).toHaveBeenCalledWith('B-P6', 'ben');
    });

    it('filters the list to the papers assigned to the caller with “Assigned to me”', async () => {
        const listPapers = vi.fn(async () => [assigned([{ user_id: 'ana', name: 'Ana' }])]);
        renderPapers({ listPapers });
        await screen.findByRole('link', { name: /Sixth paper/ });
        await userEvent.click(screen.getByRole('button', { name: 'Assigned to me' }));
        expect(listPapers).toHaveBeenLastCalledWith({ assigned: 'me' });
        expect(screen.getByRole('button', { name: 'Assigned to me' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('still offers “Assign me” and “Release” when the reviewer directory fails to load', async () => {
        const assign = vi.fn(async () => {});
        renderPapers({
            listPapers: async () => [assigned([])],
            listReviewers: async () => {
                throw new Error('directory down');
            },
            assign,
        });
        await screen.findByRole('link', { name: /Sixth paper/ });
        await userEvent.click(await screen.findByRole('button', { name: 'Assign me' }));
        expect(assign).toHaveBeenCalledWith('B-P6', 'ana');
    });

    it('shows each reviewer’s last edit as a relative time with the exact time on hover, and their op count', async () => {
        const lastEdit = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        renderPapers({
            listPapers: async () => [
                {
                    ...assigned([]),
                    total: 4,
                    reviews: [
                        {
                            user_id: 'ben',
                            user_name: 'Ben',
                            state: 'in_progress',
                            edited: 2,
                            verified: 0,
                            reviewed: 2,
                            op_count: 12,
                            last_edit_at: lastEdit,
                        },
                    ],
                },
            ],
        });
        const row = await screen.findByRole('link', { name: /Sixth paper/ });
        const edit = within(row).getByText('last edit 2 h ago, 12 ops');
        expect(edit).toHaveAttribute('title', new Date(lastEdit).toLocaleString());
    });
});

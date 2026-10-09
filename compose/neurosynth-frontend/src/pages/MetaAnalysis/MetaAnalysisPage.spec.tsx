import { Mock, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useGetMetaAnalysisById, useGetMetaAnalysisResultById } from 'hooks';
import MetaAnalysisPage from './MetaAnalysisPage';

vi.mock('hooks');
vi.mock('stores/projects/ProjectStore');
vi.mock('pages/MetaAnalysis/components/MetaAnalysisDetails');
vi.mock('pages/MetaAnalysis/hooks/useGetMetaAnalysisJobsByMetaAnalysisId', () => ({
    default: () => ({ data: [], isLoading: false, isError: false }),
}));
vi.mock('pages/MetaAnalysis/hooks/useGetMetaAnalysisJobById', () => ({
    default: () => ({ data: undefined, isLoading: false, isError: false }),
}));

const metaAnalysis = {
    id: 'meta-1',
    name: 'Attention meta-analysis',
    description: 'A demo description',
    public: true,
    username: 'ada',
    user: 'owner',
    project: 'project-1',
    results: [],
};

const renderPage = (path = '/projects/project-1/meta-analyses/meta-1') =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/projects/:projectId/meta-analyses/:metaAnalysisId" element={<MetaAnalysisPage />} />
                <Route path="/meta-analyses/:metaAnalysisId" element={<MetaAnalysisPage />} />
            </Routes>
        </MemoryRouter>
    );

describe('MetaAnalysisPage', () => {
    beforeEach(() => {
        (useGetMetaAnalysisById as Mock).mockReturnValue({
            isLoading: false,
            isError: false,
            data: metaAnalysis,
        });
        (useGetMetaAnalysisResultById as Mock).mockReturnValue({
            isLoading: false,
            isError: false,
            data: undefined,
        });
    });

    it('shows name, description, owner, and access without inline editors', () => {
        renderPage();

        expect(screen.getAllByRole('heading', { name: 'Attention meta-analysis' })).toHaveLength(2);
        expect(screen.getByText('A demo description')).toBeInTheDocument();
        expect(screen.queryByText(/·/)).not.toBeInTheDocument();
        expect(screen.getByText('Owner: ada')).toBeInTheDocument();
        expect(screen.getByText('Public')).toBeInTheDocument();
        expect(screen.getByText('No run detected')).toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: 'name' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Private/i })).not.toBeInTheDocument();
    });

    it('shows a private chip when the meta-analysis is private', () => {
        (useGetMetaAnalysisById as Mock).mockReturnValue({
            isLoading: false,
            isError: false,
            data: { ...metaAnalysis, public: false },
        });
        renderPage();

        expect(screen.getByText('Private')).toBeInTheDocument();
    });

    it('shows tags below the chips', () => {
        (useGetMetaAnalysisById as Mock).mockReturnValue({
            isLoading: false,
            isError: false,
            data: { ...metaAnalysis, tags: ['attention', ' working memory ', 'Attention'] },
        });
        renderPage();

        const attention = screen.getByText('attention');
        expect(screen.getByText('Public').compareDocumentPosition(attention)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        expect(screen.getByText('working memory')).toBeInTheDocument();
        expect(attention.closest('.MuiChip-root')).toHaveStyle({ borderRadius: '4px' });
    });

    it('shows created and last updated chips when those timestamps exist', () => {
        const createdAt = '2024-03-15T18:30:00.000Z';
        const updatedAt = '2024-06-02T09:05:00.000Z';
        (useGetMetaAnalysisById as Mock).mockReturnValue({
            isLoading: false,
            isError: false,
            data: { ...metaAnalysis, created_at: createdAt, updated_at: updatedAt },
        });
        renderPage();

        expect(screen.getByText(`Created: ${formatTimestamp(createdAt)}`)).toBeInTheDocument();
        expect(screen.getByText(`Last updated: ${formatTimestamp(updatedAt)}`)).toBeInTheDocument();
    });

    it('hides the last updated chip when the meta-analysis has not been updated', () => {
        (useGetMetaAnalysisById as Mock).mockReturnValue({
            isLoading: false,
            isError: false,
            data: { ...metaAnalysis, created_at: '2024-03-15T18:30:00.000Z', updated_at: null },
        });
        renderPage();

        expect(screen.getByText(/^Created:/)).toBeInTheDocument();
        expect(screen.queryByText(/^Last updated:/)).not.toBeInTheDocument();
    });
});

const formatTimestamp = (value: string) => {
    const date = new Date(value);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()} ${date.getHours()}:${date.getMinutes()}`;
};

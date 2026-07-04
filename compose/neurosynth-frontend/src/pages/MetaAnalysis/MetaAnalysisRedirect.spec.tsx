import { Mock, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useParams } from 'react-router-dom';
import MetaAnalysisRedirect from './MetaAnalysisRedirect';

const mockUseGet = vi.hoisted(() => vi.fn());

vi.mock('hooks/metaAnalyses/useGetMetaAnalysisById', () => ({ default: mockUseGet }));
vi.mock('react-router-dom');
vi.mock('pages/NotFound/NotFoundPage', () => ({
    default: () => <div data-testid="notfound">Not found</div>,
}));
vi.mock('components/NeurosynthLoader/NeurosynthLoader');

describe('MetaAnalysisRedirect', () => {
    beforeEach(() => {
        mockUseGet.mockReset();
        (useParams as Mock).mockReturnValue({ metaAnalysisId: '33sGF2kiiag6' });
    });

    it('redirects to the canonical project URL when resolved', () => {
        mockUseGet.mockReturnValue({ data: { project: 'wuUuxSXTbw7Z' }, isLoading: false, isError: false });
        render(<MetaAnalysisRedirect />);
        expect(screen.getByTestId('to')).toHaveTextContent('/projects/wuUuxSXTbw7Z/meta-analyses/33sGF2kiiag6');
    });

    it('shows NotFound on error', () => {
        mockUseGet.mockReturnValue({ data: undefined, isLoading: false, isError: true });
        render(<MetaAnalysisRedirect />);
        expect(screen.getByTestId('notfound')).toBeInTheDocument();
        expect(screen.queryByTestId('to')).not.toBeInTheDocument();
    });

    it('shows NotFound when the meta-analysis has no project', () => {
        mockUseGet.mockReturnValue({ data: { project: null }, isLoading: false, isError: false });
        render(<MetaAnalysisRedirect />);
        expect(screen.getByTestId('notfound')).toBeInTheDocument();
        expect(screen.queryByTestId('to')).not.toBeInTheDocument();
    });

    it('shows a loader while loading', () => {
        mockUseGet.mockReturnValue({ data: undefined, isLoading: true, isError: false });
        render(<MetaAnalysisRedirect />);
        expect(screen.getByTestId('neurosynth-loader')).toBeInTheDocument();
        expect(screen.queryByTestId('to')).not.toBeInTheDocument();
    });
});

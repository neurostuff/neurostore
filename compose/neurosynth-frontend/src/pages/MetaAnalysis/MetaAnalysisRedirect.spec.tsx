import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MetaAnalysisRedirect from './MetaAnalysisRedirect';

const mockUseGet = vi.hoisted(() => vi.fn());

vi.mock('hooks/metaAnalyses/useGetMetaAnalysisById', () => ({ default: mockUseGet }));
vi.mock('react-router-dom', async (importOriginal) => ({
    ...(await importOriginal<typeof import('react-router-dom')>()),
    useParams: () => ({ metaAnalysisId: '33sGF2kiiag6' }),
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate">{to}</div>,
}));
vi.mock('pages/NotFound/NotFoundPage', () => ({
    default: () => <div data-testid="notfound">Not found</div>,
}));
vi.mock('components/NeurosynthLoader/NeurosynthLoader', () => ({
    default: () => <div data-testid="loader" />,
}));

describe('MetaAnalysisRedirect', () => {
    beforeEach(() => mockUseGet.mockReset());

    it('redirects to the canonical project URL when resolved', () => {
        mockUseGet.mockReturnValue({ data: { project: 'wuUuxSXTbw7Z' }, isLoading: false, isError: false });
        render(<MetaAnalysisRedirect />);
        expect(screen.getByTestId('navigate')).toHaveTextContent('/projects/wuUuxSXTbw7Z/meta-analyses/33sGF2kiiag6');
    });

    it('shows NotFound on error', () => {
        mockUseGet.mockReturnValue({ data: undefined, isLoading: false, isError: true });
        render(<MetaAnalysisRedirect />);
        expect(screen.getByTestId('notfound')).toBeInTheDocument();
        expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
    });

    it('shows NotFound when the meta-analysis has no project', () => {
        mockUseGet.mockReturnValue({ data: { project: null }, isLoading: false, isError: false });
        render(<MetaAnalysisRedirect />);
        expect(screen.getByTestId('notfound')).toBeInTheDocument();
        expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
    });

    it('shows a loader while loading', () => {
        mockUseGet.mockReturnValue({ data: undefined, isLoading: true, isError: false });
        render(<MetaAnalysisRedirect />);
        expect(screen.getByTestId('loader')).toBeInTheDocument();
        expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
    });
});

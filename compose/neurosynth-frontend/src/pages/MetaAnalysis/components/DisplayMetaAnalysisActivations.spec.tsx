import { render, screen } from '@testing-library/react';
import { APA_CITATIONS_TEXT, NEUROSYNTH_COMPOSE_CITATION, NIMARE_CITATION } from 'constants/citations';
import userEvent from '@testing-library/user-event';
import DisplayMetaAnalysisActivations from './DisplayMetaAnalysisActivations';

const { mockUseGetAnalysisById } = vi.hoisted(() => ({
    mockUseGetAnalysisById: vi.fn(),
}));

vi.mock('hooks/analyses/useGetAnalysisById', () => ({
    default: mockUseGetAnalysisById,
}));

vi.mock('pages/Study/store/StudyStore.helpers', () => ({
    studyPointsToStorePoints: () => ({
        points: [],
        analysisSpace: undefined,
        analysisMap: undefined,
    }),
}));

vi.mock('pages/Study/components/StudyPoints', () => ({
    default: () => <div data-testid="mock-study-points" />,
}));

vi.mock('components/NeurosynthAccordion/NeurosynthAccordion', () => ({
    default: ({ TitleElement, children }: any) => (
        <div>
            <div>{TitleElement}</div>
            <div>{children}</div>
        </div>
    ),
}));

describe('DisplayMetaAnalysisActivations', () => {
    beforeEach(() => {
        mockUseGetAnalysisById.mockReturnValue({
            data: { points: [] },
            isLoading: false,
            isError: false,
        });
        Object.defineProperty(window.navigator, 'clipboard', {
            value: { writeText: vi.fn().mockResolvedValue(undefined) },
            configurable: true,
        });
    });

    it('shows an APA citation box containing Neurosynth Compose and NiMARE citations', () => {
        render(<DisplayMetaAnalysisActivations metaAnalysis={undefined} metaAnalysisResult={undefined} />);

        expect(screen.getByText('Citations (APA)')).toBeInTheDocument();
        expect(
            screen.getByText(/Neurosynth Compose: A web-based platform for flexible and reproducible neuroimaging meta-analysis/)
        ).toBeInTheDocument();
        expect(screen.getByText(/NiMARE: Neuroimaging Meta-Analysis Research Environment/)).toBeInTheDocument();
        expect(screen.getByText(NEUROSYNTH_COMPOSE_CITATION.doiUrl)).toBeInTheDocument();
        expect(screen.getByText(NIMARE_CITATION.doiUrl)).toBeInTheDocument();
    });

    it('copies both APA citations when clicking the copy button', async () => {
        render(<DisplayMetaAnalysisActivations metaAnalysis={undefined} metaAnalysisResult={undefined} />);

        await userEvent.click(screen.getByRole('button', { name: 'Copy APA citations' }));

        expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith(APA_CITATIONS_TEXT);
    });
});

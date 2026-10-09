import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EAnalysisType } from 'hooks/projects/Project.types';
import { useProjectAnalysisType } from 'stores/projects/ProjectStore';
import { Mock } from 'vitest';
import MoveToExtractionDialogIntroductionPart1 from './MoveToExtractionDialogIntroPart1';

vi.mock('stores/projects/ProjectStore');
vi.mock('pages/Project/components/MoveToExtractionDialogSection');

describe('MoveToExtractionDialogIntroPart1', () => {
    beforeEach(() => {
        (useProjectAnalysisType as Mock).mockReturnValue(EAnalysisType.CBMA);
    });

    it('should render the extraction intro choices and navigation actions', async () => {
        const onNext = vi.fn();
        const onSkip = vi.fn();
        render(<MoveToExtractionDialogIntroductionPart1 onNext={onNext} onSkip={onSkip} />);

        expect(screen.getByText(/Congratulations on completing the Curation phase/)).toBeInTheDocument();
        expect(screen.getByText('What would you like to do?')).toBeInTheDocument();
        expect(screen.getByText('Continue to Extraction')).toBeInTheDocument();
        expect(
            screen.getByText(
                'Finalize the data for your coordinate based meta-analysis by reviewing study coordinates and annotating analyses.'
            )
        ).toBeInTheDocument();
        expect(screen.getByText('Jump straight to specifying your meta-analysis.')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Extraction' })).toHaveAttribute(
            'href',
            'https://neurostuff.github.io/compose-docs/guide/Project/Extraction'
        );

        await userEvent.click(screen.getByRole('button', { name: 'Skip Extraction' }));
        expect(onSkip).toHaveBeenCalledTimes(1);

        await userEvent.click(screen.getByRole('button', { name: 'NEXT' }));
        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('should describe image review for IBMA projects', () => {
        (useProjectAnalysisType as Mock).mockReturnValue(EAnalysisType.IBMA);
        render(<MoveToExtractionDialogIntroductionPart1 onNext={vi.fn()} onSkip={vi.fn()} />);

        expect(
            screen.getByText(
                'Finalize the data for your image based meta-analysis by reviewing study images and annotating analyses.'
            )
        ).toBeInTheDocument();
        expect(
            screen.queryByText(
                'Finalize the data for your coordinate based meta-analysis by reviewing study coordinates and annotating analyses.'
            )
        ).not.toBeInTheDocument();
    });
});

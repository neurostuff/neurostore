import { vi, Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExtractionAdvanceButton from './ExtractionAdvanceButton';
import { useProjectId, useProjectMetaAnalysisCanEdit, useProjectUser } from 'stores/projects/ProjectStore';
import { useGetExtractionSummary, useUserCanEdit } from 'hooks';
import { enqueueSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';

vi.mock('stores/projects/ProjectStore');
vi.mock('hooks');
vi.mock('notistack');
vi.mock('react-router-dom');

const mockExtractionIncomplete = () => {
    const extractionSummary = useGetExtractionSummary('');
    extractionSummary.completed = 1;
    extractionSummary.total = 4;
    extractionSummary.savedForLater = 0;
    extractionSummary.unreviewed = 3;
};

const mockExtractionComplete = () => {
    const extractionSummary = useGetExtractionSummary('');
    extractionSummary.completed = 4;
    extractionSummary.total = 4;
    extractionSummary.savedForLater = 0;
    extractionSummary.unreviewed = 0;
};

describe('ExtractionAdvanceButton', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useProjectId as Mock).mockReturnValue('test-project-id');
        (useProjectUser as Mock).mockReturnValue('user-1');
        (useProjectMetaAnalysisCanEdit as Mock).mockReturnValue(false);
        (useUserCanEdit as Mock).mockReturnValue(true);
        mockExtractionIncomplete();
    });

    it('shows Start Meta-Analysis when extraction is incomplete', () => {
        render(<ExtractionAdvanceButton />);

        expect(screen.getByRole('button', { name: 'Start Meta-Analysis' })).toBeInTheDocument();
    });

    it('is enabled when extraction is incomplete and the user can edit', () => {
        render(<ExtractionAdvanceButton />);

        expect(screen.getByRole('button', { name: 'Start Meta-Analysis' })).toBeEnabled();
    });

    it('renders as text when extraction is incomplete', () => {
        render(<ExtractionAdvanceButton />);

        expect(screen.getByRole('button', { name: 'Start Meta-Analysis' })).toHaveClass('MuiButton-text');
        expect(screen.getByRole('button', { name: 'Start Meta-Analysis' })).not.toHaveClass('MuiButton-contained');
    });

    it('renders as contained when extraction is complete', () => {
        mockExtractionComplete();

        render(<ExtractionAdvanceButton />);

        expect(screen.getByRole('button', { name: 'Start Meta-Analysis' })).toHaveClass('MuiButton-contained');
        expect(screen.getByRole('button', { name: 'Start Meta-Analysis' })).not.toHaveClass('MuiButton-text');
    });

    it('shows a priority icon when extraction is complete', () => {
        mockExtractionComplete();

        render(<ExtractionAdvanceButton />);

        expect(screen.getByTestId('PriorityHighIcon')).toBeInTheDocument();
    });

    it('does not show a priority icon when extraction is incomplete', () => {
        render(<ExtractionAdvanceButton />);

        expect(screen.queryByTestId('PriorityHighIcon')).not.toBeInTheDocument();
    });

    it('is disabled when the user cannot edit', () => {
        (useUserCanEdit as Mock).mockReturnValue(false);

        render(<ExtractionAdvanceButton />);

        expect(screen.getByRole('button', { name: 'Start Meta-Analysis' })).toBeDisabled();
    });

    it('shows a warning snackbar instead of navigating when extraction is incomplete', () => {
        render(<ExtractionAdvanceButton />);
        fireEvent.click(screen.getByRole('button', { name: 'Start Meta-Analysis' }));

        expect(useNavigate()).not.toHaveBeenCalled();
        expect(enqueueSnackbar).toHaveBeenCalledTimes(1);

        const [content, options] = (enqueueSnackbar as Mock).mock.calls[0];
        expect(options).toMatchObject({ variant: 'warning', autoHideDuration: null });

        const { getByText } = render(content);
        expect(getByText('There are still studies that have not been marked as completed')).toBeInTheDocument();
        expect(
            getByText(
                'Alternatively, you can automatically mark all studies as completed by clicking the button "Mark all as complete".'
            )
        ).toBeInTheDocument();
    });

    it('navigates to the project page and does not show the incomplete snackbar when extraction is complete', () => {
        mockExtractionComplete();

        render(<ExtractionAdvanceButton />);
        fireEvent.click(screen.getByRole('button', { name: 'Start Meta-Analysis' }));

        expect(enqueueSnackbar).not.toHaveBeenCalled();
        expect(useNavigate()).toHaveBeenCalledWith('/projects/test-project-id/project', {
            state: {
                projectPage: {
                    scrollToMetaAnalysisProceed: true,
                },
            },
        });
    });

    it('shows View meta-analyses as contained with no priority icon when the meta-analysis step is enabled', () => {
        (useProjectMetaAnalysisCanEdit as Mock).mockReturnValue(true);
        mockExtractionComplete();

        render(<ExtractionAdvanceButton />);

        const button = screen.getByRole('button', { name: 'View meta-analyses' });
        expect(button).toHaveClass('MuiButton-contained');
        expect(screen.queryByTestId('PriorityHighIcon')).not.toBeInTheDocument();
    });

    it('navigates to the meta-analyses page when the meta-analysis step is enabled', () => {
        (useProjectMetaAnalysisCanEdit as Mock).mockReturnValue(true);

        render(<ExtractionAdvanceButton />);
        fireEvent.click(screen.getByRole('button', { name: 'View meta-analyses' }));

        expect(enqueueSnackbar).not.toHaveBeenCalled();
        expect(useNavigate()).toHaveBeenCalledWith('/projects/test-project-id/meta-analyses');
    });
});

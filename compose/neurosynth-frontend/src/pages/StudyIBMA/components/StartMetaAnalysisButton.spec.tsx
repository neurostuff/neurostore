import { vi, Mock } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import StartMetaAnalysisButton from './StartMetaAnalysisButton';
import {
    useProjectId,
    useProjectMetaAnalysisCanEdit,
    useProjectUser,
} from 'stores/projects/ProjectStore';
import { hasUnsavedStudyChanges, unsetUnloadHandler } from 'helpers/BeforeUnload.helpers';
import { useGetExtractionSummary, useUserCanEdit } from 'hooks';
import { useSnackbar } from 'notistack';

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('stores/projects/ProjectStore');
vi.mock('helpers/BeforeUnload.helpers', () => ({
    hasUnsavedStudyChanges: vi.fn(),
    unsetUnloadHandler: vi.fn(),
}));
vi.mock('hooks', () => ({
    useUserCanEdit: vi.fn(),
    useGetExtractionSummary: vi.fn(),
}));
vi.mock('notistack');
vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
}));

const mockExtractionComplete = () => {
    (useGetExtractionSummary as Mock).mockReturnValue({
        completed: 3,
        total: 3,
        savedForLater: 0,
        unreviewed: 0,
    });
};

describe('StartMetaAnalysisButton', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useProjectId as Mock).mockReturnValue('test-project-id');
        (useProjectMetaAnalysisCanEdit as Mock).mockReturnValue(true);
        (useProjectUser as Mock).mockReturnValue('user-1');
        (useUserCanEdit as Mock).mockReturnValue(true);
        mockExtractionComplete();
        (hasUnsavedStudyChanges as Mock).mockReturnValue(false);
    });

    it('shows Start Meta Analysis when the meta-analysis step has not been started yet', () => {
        (useProjectMetaAnalysisCanEdit as Mock).mockReturnValue(false);

        render(<StartMetaAnalysisButton />);

        expect(screen.getByRole('button', { name: /Start Meta Analysis/i })).toBeInTheDocument();
    });

    it('navigates to project page with scrollToMetaAnalysisProceed when there are no unsaved changes', () => {
        render(<StartMetaAnalysisButton />);
        fireEvent.click(screen.getByRole('button', { name: /View Meta Analyses/i }));

        expect(mockNavigate).toHaveBeenCalledWith('/projects/test-project-id/project', {
            state: {
                projectPage: {
                    scrollToMetaAnalysisProceed: true,
                },
            },
        });
    });

    it('shows a warning snackbar when extraction is not complete', () => {
        (useGetExtractionSummary as Mock).mockReturnValue({
            completed: 1,
            total: 3,
            savedForLater: 0,
            unreviewed: 2,
        });

        render(<StartMetaAnalysisButton />);
        fireEvent.click(screen.getByRole('button', { name: /View Meta Analyses/i }));

        expect(mockNavigate).not.toHaveBeenCalled();
        expect((useSnackbar() as unknown as { enqueueSnackbar: Mock }).enqueueSnackbar).toHaveBeenCalledWith(
            'Extraction is not complete. You still have 2 studies to complete before you can start a meta-analysis.',
            { variant: 'warning' }
        );
    });

    it('opens confirmation dialog when there are unsaved changes, then navigates after confirm', () => {
        (hasUnsavedStudyChanges as Mock).mockReturnValue(true);

        render(<StartMetaAnalysisButton />);
        fireEvent.click(screen.getByRole('button', { name: /View Meta Analyses/i }));

        expect(mockNavigate).not.toHaveBeenCalled();

        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText(/you have unsaved changes/i)).toBeInTheDocument();

        fireEvent.click(within(dialog).getByRole('button', { name: /^continue$/i }));

        expect(unsetUnloadHandler).toHaveBeenCalledWith('study');
        expect(unsetUnloadHandler).toHaveBeenCalledWith('annotation');
        expect(mockNavigate).toHaveBeenCalledWith('/projects/test-project-id/project', {
            state: {
                projectPage: {
                    scrollToMetaAnalysisProceed: true,
                },
            },
        });
    });
});

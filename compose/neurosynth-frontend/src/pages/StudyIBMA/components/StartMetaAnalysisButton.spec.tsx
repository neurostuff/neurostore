import { vi, Mock } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import StartMetaAnalysisButton from './StartMetaAnalysisButton';
import { useProjectId, useProjectUser } from 'pages/Project/store/ProjectStore';
import { hasUnsavedStudyChanges, unsetUnloadHandler } from 'helpers/BeforeUnload.helpers';
import { useGetExtractionSummary, useUserCanEdit } from 'hooks';

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('pages/Project/store/ProjectStore');
vi.mock('helpers/BeforeUnload.helpers', () => ({
    hasUnsavedStudyChanges: vi.fn(),
    unsetUnloadHandler: vi.fn(),
}));
vi.mock('hooks', () => ({
    useUserCanEdit: vi.fn(),
    useGetExtractionSummary: vi.fn(),
}));
vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
}));

describe('StartMetaAnalysisButton', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useProjectId as Mock).mockReturnValue('test-project-id');
        (useProjectUser as Mock).mockReturnValue('user-1');
        (useUserCanEdit as Mock).mockReturnValue(true);
        (useGetExtractionSummary as Mock).mockReturnValue({
            completed: 0,
            total: 0,
            savedForLater: 0,
            unreviewed: 0,
        });
        (hasUnsavedStudyChanges as Mock).mockReturnValue(false);
    });

    it('navigates to project page with scrollToMetaAnalysisProceed when there are no unsaved changes', () => {
        render(<StartMetaAnalysisButton />);
        fireEvent.click(screen.getByRole('button', { name: /continue to meta-analysis/i }));

        expect(mockNavigate).toHaveBeenCalledWith('/projects/test-project-id/project', {
            state: {
                projectPage: {
                    scrollToMetaAnalysisProceed: true,
                },
            },
        });
    });

    it('opens confirmation dialog when there are unsaved changes, then navigates after confirm', () => {
        (hasUnsavedStudyChanges as Mock).mockReturnValue(true);

        render(<StartMetaAnalysisButton />);
        fireEvent.click(screen.getByRole('button', { name: /continue to meta-analysis/i }));

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

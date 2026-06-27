import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useGetStudysetNonNestedById, useUserCanEdit } from 'hooks';
import { EExtractionStatus } from 'pages/Extraction/Extraction.types';
import {
    useProjectExtractionAddOrUpdateStudyListStatus,
    useProjectExtractionStudysetId,
} from 'stores/projects/ProjectStore';
import EditStudyToolbarNext from 'pages/StudyIBMA/components/EditStudyToolbarNext';
import { useParams } from 'react-router-dom';
import { Mock, vi } from 'vitest';

vi.mock('hooks');
vi.mock('pages/StudyCBMA/hooks/useSaveStudy');
vi.mock('react-router-dom');
vi.mock('stores/study/StudyStore');
vi.mock('stores/projects/ProjectStore');
vi.mock('pages/StudyCBMA/components/EditStudySwapVersionButton');
vi.mock('components/Dialogs/ConfirmationDialog');

describe('EditStudyToolbarNext Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.sessionStorage.clear();
        (useParams as Mock).mockReturnValue({ projectId: 'projectid', studyId: 'study-id' });
        (useProjectExtractionStudysetId as Mock).mockReturnValue('studysetid');
        (useUserCanEdit as Mock).mockReturnValue(true);
        (useGetStudysetNonNestedById as Mock).mockReturnValue({
            data: { studies: [] },
            isLoading: false,
            isError: false,
        });
    });

    it('should render', () => {
        render(<EditStudyToolbarNext />);
    });

    describe('status buttons', () => {
        it('should set to completed', async () => {
            render(<EditStudyToolbarNext />);
            await userEvent.click(screen.getByRole('button', { name: /Complete/i }));
            expect(useProjectExtractionAddOrUpdateStudyListStatus()).toHaveBeenCalledWith(
                'study-id',
                EExtractionStatus.COMPLETED
            );
        });

        it('should set to saved for later', async () => {
            render(<EditStudyToolbarNext />);
            await userEvent.click(screen.getByRole('button', { name: /Save for later/i }));
            expect(useProjectExtractionAddOrUpdateStudyListStatus()).toHaveBeenCalledWith(
                'study-id',
                EExtractionStatus.SAVEDFORLATER
            );
        });

        it('should set to uncategorized', async () => {
            render(<EditStudyToolbarNext />);
            await userEvent.click(screen.getByRole('button', { name: /Unreviewed/i }));
            expect(useProjectExtractionAddOrUpdateStudyListStatus()).toHaveBeenCalledWith(
                'study-id',
                EExtractionStatus.UNCATEGORIZED
            );
        });
    });
});

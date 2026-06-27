import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useGetStudysetSummaryById, useUserCanEdit } from 'hooks';
import ExtractionStudiesPreviewer from 'pages/StudyIBMA/components/ExtractionStudiesPreviewer';
import {
    useProjectExtractionStudysetId,
    useProjectExtractionStudyStatusList,
    useProjectId,
    useProjectUser,
} from 'stores/projects/ProjectStore';
import { useNavigate, useParams } from 'react-router-dom';
import { Mock, vi } from 'vitest';

vi.mock('hooks');
vi.mock('react-router-dom');
vi.mock('stores/study/StudyStore');
vi.mock('stores/projects/ProjectStore');
vi.mock('components/Dialogs/ConfirmationDialog');

describe('ExtractionStudiesPreviewer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.sessionStorage.clear();
        (useProjectId as Mock).mockReturnValue('projectid');
        (useParams as Mock).mockReturnValue({ projectId: 'projectid', studyId: 'study-1' });
        (useProjectExtractionStudysetId as Mock).mockReturnValue('studysetid');
        (useProjectUser as Mock).mockReturnValue({});
        (useUserCanEdit as Mock).mockReturnValue(true);
        (useProjectExtractionStudyStatusList as Mock).mockReturnValue([
            { id: 'study-1', status: 'completed' },
            { id: 'study-2', status: 'savedforlater' },
            { id: 'study-3', status: 'uncategorized' },
        ]);
        (useGetStudysetSummaryById as Mock).mockReturnValue({
            data: {
                studies: [
                    { id: 'study-1', name: 'Alpha', analyses: ['a1', 'a2'] },
                    { id: 'study-2', name: 'Beta', analyses: ['b1'] },
                    { id: 'study-3', name: 'Gamma', analyses: [] },
                ],
            },
            isLoading: false,
            isError: false,
        });
    });

    it('navigates to the next study when NEXT is clicked', async () => {
        window.sessionStorage.setItem(
            'projectid-extraction-table',
            JSON.stringify({
                columnFilters: [],
                sorting: [],
                studies: ['study-1', 'study-2', 'study-3'],
                pagination: { pageIndex: 0, pageSize: 25 },
            })
        );
        (useParams as Mock).mockReturnValue({ projectId: 'projectid', studyId: 'study-1' });

        render(<ExtractionStudiesPreviewer />);
        await userEvent.click(screen.getByTestId('extraction-previewer-next'));
        expect(useNavigate()).toHaveBeenCalledWith('/projects/projectid/extraction/studies/study-2/edit');
    });

    it('navigates to the previous study when PREVIOUS is clicked', async () => {
        window.sessionStorage.setItem(
            'projectid-extraction-table',
            JSON.stringify({
                columnFilters: [],
                sorting: [],
                studies: ['study-1', 'study-2', 'study-3'],
                pagination: { pageIndex: 0, pageSize: 25 },
            })
        );
        (useParams as Mock).mockReturnValue({ projectId: 'projectid', studyId: 'study-2' });

        render(<ExtractionStudiesPreviewer />);
        await userEvent.click(screen.getByTestId('extraction-previewer-prev'));
        expect(useNavigate()).toHaveBeenCalledWith('/projects/projectid/extraction/studies/study-1/edit');
    });

    it('navigates when a study card is clicked', async () => {
        window.sessionStorage.setItem(
            'projectid-extraction-table',
            JSON.stringify({
                columnFilters: [],
                sorting: [],
                studies: ['study-1', 'study-2', 'study-3'],
                pagination: { pageIndex: 0, pageSize: 25 },
            })
        );
        (useParams as Mock).mockReturnValue({ projectId: 'projectid', studyId: 'study-1' });

        render(<ExtractionStudiesPreviewer />);
        await userEvent.click(screen.getByTestId('extraction-previewer-study-study-3'));
        expect(useNavigate()).toHaveBeenCalledWith('/projects/projectid/extraction/studies/study-3/edit');
    });

    it('shows active extraction column filters when stored in session', () => {
        window.sessionStorage.setItem(
            'projectid-extraction-table',
            JSON.stringify({
                columnFilters: [{ id: 'status', value: 'completed' }],
                sorting: [],
                studies: ['study-1'],
                pagination: { pageIndex: 0, pageSize: 25 },
            })
        );
        (useParams as Mock).mockReturnValue({ projectId: 'projectid', studyId: 'study-1' });

        render(<ExtractionStudiesPreviewer />);
        expect(screen.getByText('Active filters')).toBeInTheDocument();
        expect(screen.getByText('Status: completed')).toBeInTheDocument();
    });

    it('disables PREVIOUS on the first study and NEXT on the last study', () => {
        window.sessionStorage.setItem(
            'projectid-extraction-table',
            JSON.stringify({
                columnFilters: [],
                sorting: [],
                studies: ['study-1', 'study-2', 'study-3'],
                pagination: { pageIndex: 0, pageSize: 25 },
            })
        );
        (useParams as Mock).mockReturnValue({ projectId: 'projectid', studyId: 'study-1' });

        const { rerender } = render(<ExtractionStudiesPreviewer />);
        expect(screen.getByTestId('extraction-previewer-prev')).toBeDisabled();
        expect(screen.getByTestId('extraction-previewer-next')).not.toBeDisabled();

        (useParams as Mock).mockReturnValue({ projectId: 'projectid', studyId: 'study-3' });
        rerender(<ExtractionStudiesPreviewer />);
        expect(screen.getByTestId('extraction-previewer-next')).toBeDisabled();
        expect(screen.getByTestId('extraction-previewer-prev')).not.toBeDisabled();
    });
});

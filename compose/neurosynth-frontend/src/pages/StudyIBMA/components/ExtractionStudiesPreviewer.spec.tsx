import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setUnloadHandler } from 'helpers/BeforeUnload.helpers';
import { useGetStudysetById, useUserCanEdit } from 'hooks';
import ExtractionStudiesPreviewer from 'pages/StudyIBMA/components/ExtractionStudiesPreviewer';
import {
    useProjectExtractionStudysetId,
    useProjectExtractionStudyStatusList,
    useProjectId,
    useProjectUser,
} from 'stores/projects/ProjectStore';
import { useStudyId } from 'stores/study/StudyStore';
import { useNavigate } from 'react-router-dom';
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
        (useProjectExtractionStudysetId as Mock).mockReturnValue('studysetid');
        (useProjectUser as Mock).mockReturnValue({});
        (useUserCanEdit as Mock).mockReturnValue(true);
        (useProjectExtractionStudyStatusList as Mock).mockReturnValue([
            { id: 'study-1', status: 'completed' },
            { id: 'study-2', status: 'savedforlater' },
            { id: 'study-3', status: 'uncategorized' },
        ]);
        (useGetStudysetById as Mock).mockReturnValue({
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

    it('navigates to the next study when NEXT is clicked', () => {
        window.sessionStorage.setItem(
            'projectid-extraction-table',
            JSON.stringify({
                columnFilters: [],
                sorting: [],
                studies: ['study-1', 'study-2', 'study-3'],
                pagination: { pageIndex: 0, pageSize: 25 },
            })
        );
        (useStudyId as Mock).mockReturnValue('study-1');

        render(<ExtractionStudiesPreviewer />);
        userEvent.click(screen.getByTestId('extraction-previewer-next'));
        expect(useNavigate()).toHaveBeenCalledWith('/projects/projectid/extraction/studies/study-2/edit');
    });

    it('navigates to the previous study when PREVIOUS is clicked', () => {
        window.sessionStorage.setItem(
            'projectid-extraction-table',
            JSON.stringify({
                columnFilters: [],
                sorting: [],
                studies: ['study-1', 'study-2', 'study-3'],
                pagination: { pageIndex: 0, pageSize: 25 },
            })
        );
        (useStudyId as Mock).mockReturnValue('study-2');

        render(<ExtractionStudiesPreviewer />);
        userEvent.click(screen.getByTestId('extraction-previewer-prev'));
        expect(useNavigate()).toHaveBeenCalledWith('/projects/projectid/extraction/studies/study-1/edit');
    });

    it('navigates when a study card is clicked', () => {
        window.sessionStorage.setItem(
            'projectid-extraction-table',
            JSON.stringify({
                columnFilters: [],
                sorting: [],
                studies: ['study-1', 'study-2', 'study-3'],
                pagination: { pageIndex: 0, pageSize: 25 },
            })
        );
        (useStudyId as Mock).mockReturnValue('study-1');

        render(<ExtractionStudiesPreviewer />);
        userEvent.click(screen.getByTestId('extraction-previewer-study-study-3'));
        expect(useNavigate()).toHaveBeenCalledWith('/projects/projectid/extraction/studies/study-3/edit');
    });

    it('opens confirmation when navigating with unsaved changes', async () => {
        window.sessionStorage.setItem(
            'projectid-extraction-table',
            JSON.stringify({
                columnFilters: [],
                sorting: [],
                studies: ['study-1', 'study-2', 'study-3'],
                pagination: { pageIndex: 0, pageSize: 25 },
            })
        );
        setUnloadHandler('study');
        (useStudyId as Mock).mockReturnValue('study-1');

        render(<ExtractionStudiesPreviewer />);
        userEvent.click(screen.getByTestId('extraction-previewer-next'));
        await waitFor(() => {
            expect(screen.getByTestId('mock-confirmation-dialog')).toBeInTheDocument();
        });
        expect(useNavigate()).not.toHaveBeenCalled();
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
        (useStudyId as Mock).mockReturnValue('study-1');

        render(<ExtractionStudiesPreviewer />);
        expect(screen.getByText('Active filters')).toBeInTheDocument();
        expect(screen.getByText('Status: Complete')).toBeInTheDocument();
    });
});

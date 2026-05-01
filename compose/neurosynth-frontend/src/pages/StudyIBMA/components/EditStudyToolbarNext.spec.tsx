import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setUnloadHandler } from 'helpers/BeforeUnload.helpers';
import { useGetStudysetById, useUserCanEdit } from 'hooks';
import { EExtractionStatus } from 'pages/Extraction/Extraction.types';
import {
    useProjectExtractionAddOrUpdateStudyListStatus,
    useProjectExtractionStudysetId,
    useProjectId,
} from 'stores/projects/ProjectStore';
import EditStudyToolbarNext from 'pages/StudyIBMA/components/EditStudyToolbarNext';
import { useNavigate } from 'react-router-dom';
import { useStudyId } from 'stores/study/StudyStore';
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
    });

    it('should render', () => {
        render(<EditStudyToolbarNext />);
    });

    describe('status buttons', () => {
        it('should set to completed', () => {
            render(<EditStudyToolbarNext />);
            const checkIcon = screen.getByTestId('CheckIcon');
            userEvent.click(checkIcon);
            expect(useProjectExtractionAddOrUpdateStudyListStatus()).toHaveBeenCalledWith(
                'study-id',
                EExtractionStatus.COMPLETED
            );
        });

        it('should set to saved for later', () => {
            render(<EditStudyToolbarNext />);
            const bookmarkIcon = screen.getByTestId('BookmarkIcon');
            userEvent.click(bookmarkIcon);
            expect(useProjectExtractionAddOrUpdateStudyListStatus()).toHaveBeenCalledWith(
                'study-id',
                EExtractionStatus.SAVEDFORLATER
            );
        });

        it('should set to uncategorized', () => {
            render(<EditStudyToolbarNext />);
            const questionIcon = screen.getByTestId('QuestionMarkIcon');
            userEvent.click(questionIcon);
            expect(useProjectExtractionAddOrUpdateStudyListStatus()).toHaveBeenCalledWith(
                'study-id',
                EExtractionStatus.UNCATEGORIZED
            );
        });
    });

    describe('previous button', () => {
        it('should move to previous study when receiving state from the table', () => {
            window.sessionStorage.setItem(
                `projectid-extraction-table`,
                JSON.stringify({
                    columnFilters: [],
                    sorting: [],
                    studies: ['study-1', 'study-2', 'study-3', 'study-4'],
                    pagination: { pageIndex: 0, pageSize: 25 },
                })
            );
            (useStudyId as Mock).mockReturnValue('study-2');
            (useProjectExtractionStudysetId as Mock).mockReturnValue('studysetid');
            (useProjectId as Mock).mockReturnValue('projectid');
            (useUserCanEdit as Mock).mockReturnValue(true);

            render(<EditStudyToolbarNext />);
            userEvent.click(screen.getByTestId('KeyboardArrowLeftIcon'));
            expect(useNavigate()).toHaveBeenCalledWith('/projects/projectid/extraction/studies/study-1/edit');
        });

        it('should show a popup if there are unsaved changes when going to previous', () => {
            window.sessionStorage.setItem(
                `projectid-extraction-table`,
                JSON.stringify({
                    columnFilters: [],
                    sorting: [],
                    studies: ['study-1', 'study-2', 'study-3', 'study-4'],
                    pagination: { pageIndex: 0, pageSize: 25 },
                })
            );
            setUnloadHandler('study');
            (useStudyId as Mock).mockReturnValue('study-2');
            (useProjectExtractionStudysetId as Mock).mockReturnValue('studysetid');
            (useProjectId as Mock).mockReturnValue('projectid');
            (useUserCanEdit as Mock).mockReturnValue(true);

            render(<EditStudyToolbarNext />);
            userEvent.click(screen.getByTestId('KeyboardArrowLeftIcon'));
            expect(useNavigate()).not.toHaveBeenCalledWith('/projects/projectid/extraction/studies/study-1/edit');
            expect(screen.getByTestId('mock-confirmation-dialog')).toBeInTheDocument();
        });

        it('should move to previous study if there is no state received from the table', () => {
            (useStudyId as Mock).mockReturnValue('study-3');
            (useProjectExtractionStudysetId as Mock).mockReturnValue('studysetid');
            (useProjectId as Mock).mockReturnValue('projectid');
            (useUserCanEdit as Mock).mockReturnValue(true);

            (useGetStudysetById as Mock).mockReturnValue({
                data: { studies: ['study-2', 'study-3', 'study-4'] },
            });

            render(<EditStudyToolbarNext />);
            userEvent.click(screen.getByTestId('KeyboardArrowLeftIcon'));
            expect(useNavigate()).toHaveBeenCalledWith('/projects/projectid/extraction/studies/study-2/edit');
        });

        it('should disable the back button if on the first study', () => {
            (useStudyId as Mock).mockReturnValue('study-2');
            (useProjectExtractionStudysetId as Mock).mockReturnValue('studysetid');
            (useProjectId as Mock).mockReturnValue('projectid');
            (useUserCanEdit as Mock).mockReturnValue(true);

            (useGetStudysetById as Mock).mockReturnValue({
                data: { studies: [{ id: 'study-2' }, { id: 'study-3' }, { id: 'study-4' }] },
            });

            render(<EditStudyToolbarNext />);
            const arrowBackIcon = screen.getByTestId('KeyboardArrowLeftIcon').parentElement;
            expect(arrowBackIcon).toBeDisabled();
        });
    });

    describe('next button', () => {
        it('should move to the next study when receiving state from the table', () => {
            window.sessionStorage.setItem(
                `projectid-extraction-table`,
                JSON.stringify({
                    columnFilters: [],
                    sorting: [],
                    studies: ['study-1', 'study-2', 'study-3', 'study-4'],
                    pagination: { pageIndex: 0, pageSize: 25 },
                })
            );
            (useStudyId as Mock).mockReturnValue('study-2');
            (useProjectExtractionStudysetId as Mock).mockReturnValue('studysetid');
            (useProjectId as Mock).mockReturnValue('projectid');
            (useUserCanEdit as Mock).mockReturnValue(true);

            render(<EditStudyToolbarNext />);
            userEvent.click(screen.getByTestId('KeyboardArrowRightIcon'));
            expect(useNavigate()).toHaveBeenCalledWith('/projects/projectid/extraction/studies/study-3/edit');
        });

        it('should show a popup if there are unsaved changes when going to next', () => {
            window.sessionStorage.setItem(
                `projectid-extraction-table`,
                JSON.stringify({
                    columnFilters: [],
                    sorting: [],
                    studies: ['study-1', 'study-2', 'study-3', 'study-4'],
                    pagination: { pageIndex: 0, pageSize: 25 },
                })
            );
            setUnloadHandler('study');
            (useStudyId as Mock).mockReturnValue('study-2');
            (useProjectExtractionStudysetId as Mock).mockReturnValue('studysetid');
            (useProjectId as Mock).mockReturnValue('projectid');
            (useUserCanEdit as Mock).mockReturnValue(true);

            render(<EditStudyToolbarNext />);
            userEvent.click(screen.getByTestId('KeyboardArrowRightIcon'));
            expect(useNavigate()).not.toHaveBeenCalledWith('/projects/projectid/extraction/studies/study-3/edit');
            expect(screen.getByTestId('mock-confirmation-dialog')).toBeInTheDocument();
        });

        it('should move to the next study if there is no state received from the table', () => {
            (useStudyId as Mock).mockReturnValue('study-3');
            (useProjectExtractionStudysetId as Mock).mockReturnValue('studysetid');
            (useProjectId as Mock).mockReturnValue('projectid');
            (useUserCanEdit as Mock).mockReturnValue(true);

            (useGetStudysetById as Mock).mockReturnValue({
                data: { studies: ['study-2', 'study-3', 'study-4'] },
            });

            render(<EditStudyToolbarNext />);
            userEvent.click(screen.getByTestId('KeyboardArrowRightIcon'));
            expect(useNavigate()).toHaveBeenCalledWith('/projects/projectid/extraction/studies/study-4/edit');
        });

        it('should disable the next button if on the last study', () => {
            window.sessionStorage.setItem(
                `projectid-extraction-table`,
                JSON.stringify({
                    columnFilters: [],
                    sorting: [],
                    pagination: { pageIndex: 0, pageSize: 25 },
                    studies: ['study-1', 'study-2', 'study-3', 'study-4'],
                })
            );
            (useStudyId as Mock).mockReturnValue('study-4');
            (useProjectExtractionStudysetId as Mock).mockReturnValue('studysetid');
            (useProjectId as Mock).mockReturnValue('projectid');
            (useUserCanEdit as Mock).mockReturnValue(true);

            render(<EditStudyToolbarNext />);
            const arrowForwardIcon = screen.getByTestId('KeyboardArrowRightIcon').parentElement;
            expect(arrowForwardIcon).toBeDisabled();
        });
    });
});

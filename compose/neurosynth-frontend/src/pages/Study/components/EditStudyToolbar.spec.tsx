import { vi, Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useGetExtractionSummary, useGetStudysetById, useUserCanEdit } from 'hooks';
import { EExtractionStatus } from 'pages/Extraction/ExtractionPage';
import {
    useProjectExtractionAddOrUpdateStudyListStatus,
    useProjectExtractionStudysetId,
    useProjectId,
} from 'pages/Project/store/ProjectStore';
import { useStudyId } from 'pages/Study/store/StudyStore';
import { useNavigate } from 'react-router-dom';
import EditStudyToolbar from './EditStudyToolbar';
import { setUnloadHandler } from 'helpers/BeforeUnload.helpers';

vi.mock('hooks');
vi.mock('pages/Study/hooks/useSaveStudy.tsx');
vi.mock('react-router-dom');
vi.mock('pages/Project/store/ProjectStore.ts');
vi.mock('pages/Study/store/StudyStore.ts');
vi.mock('pages/Study/components/EditStudySwapVersionButton.tsx');
vi.mock('components/Dialogs/ConfirmationDialog.tsx');

describe('EditStudyToolbar Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.sessionStorage.clear();
    });

    it('should render', () => {
        render(<EditStudyToolbar />);
    });

    it.each([
        [0, 0, 0, 0, 0],
        [0, 10, 0, 0, 10],
        [10, 0, 0, 0, 0],
        [7, 14, 50, 7, 14],
    ])(
        'testing with completed: %i and total: %i | expected %i percentage, expected %i completed and expected %i total',
        async (completed, total, expectedPercentage, expectedCompleted, expectedTotal) => {
            const extractionSummary = useGetExtractionSummary('');
            extractionSummary.completed = completed;
            extractionSummary.total = total;
            render(<EditStudyToolbar />);
            expect(screen.getByText(`${expectedPercentage}%`)).toBeInTheDocument();

            userEvent.hover(screen.getByText(`${expectedPercentage}%`));
            const tooltip = await screen.findByRole('tooltip');
            expect(tooltip).toBeInTheDocument();
            expect(tooltip).toHaveTextContent(
                `${expectedCompleted} / ${expectedTotal} studies marked as complete`
            );
        }
    );

    it('should show the done all icon', () => {
        useGetExtractionSummary('').completed = 21;
        useGetExtractionSummary('').total = 21;
        render(<EditStudyToolbar />);
        expect(screen.getByTestId('DoneAllIcon')).toBeInTheDocument();
    });

    it('should move on to the specification phase', () => {
        useGetExtractionSummary('').completed = 21;
        useGetExtractionSummary('').total = 21;
        render(<EditStudyToolbar />);
        userEvent.click(screen.getByTestId('DoneAllIcon'));
        expect(useNavigate()).toHaveBeenCalledWith('/projects/project-id/project', {
            state: {
                projectPage: {
                    scrollToMetaAnalysisProceed: true,
                },
            },
        });
    });

    describe('status buttons', () => {
        it('should set to completed', () => {
            render(<EditStudyToolbar />);
            const checkIcon = screen.getByTestId('CheckIcon');
            userEvent.click(checkIcon);
            expect(useProjectExtractionAddOrUpdateStudyListStatus()).toHaveBeenCalledWith(
                'study-id',
                EExtractionStatus.COMPLETED
            );
        });

        it('should set to saved for later', () => {
            render(<EditStudyToolbar />);
            const bookmarkIcon = screen.getByTestId('BookmarkIcon');
            userEvent.click(bookmarkIcon);
            expect(useProjectExtractionAddOrUpdateStudyListStatus()).toHaveBeenCalledWith(
                'study-id',
                EExtractionStatus.SAVEDFORLATER
            );
        });

        it('should set to uncategorized', () => {
            render(<EditStudyToolbar />);
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
            // ARRANGE
            window.sessionStorage.setItem(
                `projectid-extraction-table`,
                JSON.stringify({
                    columnFilters: [],
                    sorting: [],
                    studies: ['study-1', 'study-2', 'study-3', 'study-4'],
                })
            );
            (useStudyId as Mock).mockReturnValue('study-2');
            (useProjectExtractionStudysetId as Mock).mockReturnValue('studysetid');
            (useProjectId as Mock).mockReturnValue('projectid');
            (useUserCanEdit as Mock).mockReturnValue(true);

            render(<EditStudyToolbar />);
            // ACT
            userEvent.click(screen.getByTestId('KeyboardArrowLeftIcon'));
            // ASSERT
            expect(useNavigate()).toHaveBeenCalledWith(
                '/projects/projectid/extraction/studies/study-1/edit'
            );
        });

        it('should show a popup if there are unsaved changes when going to previous', () => {
            // ARRANGE
            window.sessionStorage.setItem(
                `projectid-extraction-table`,
                JSON.stringify({
                    columnFilters: [],
                    sorting: [],
                    studies: ['study-1', 'study-2', 'study-3', 'study-4'],
                })
            );
            setUnloadHandler('study'); // simulate an unsaved change
            (useStudyId as Mock).mockReturnValue('study-2');
            (useProjectExtractionStudysetId as Mock).mockReturnValue('studysetid');
            (useProjectId as Mock).mockReturnValue('projectid');
            (useUserCanEdit as Mock).mockReturnValue(true);

            render(<EditStudyToolbar />);
            // ACT
            userEvent.click(screen.getByTestId('KeyboardArrowLeftIcon'));
            // ASSERT
            expect(useNavigate()).not.toHaveBeenCalledWith(
                '/projects/projectid/extraction/studies/study-1/edit'
            );
            expect(screen.getByTestId('mock-confirmation-dialog')).toBeInTheDocument();
        });

        it('should move to previous study if there is no state received from the table', () => {
            // ARRANGE
            (useStudyId as Mock).mockReturnValue('study-3');
            (useProjectExtractionStudysetId as Mock).mockReturnValue('studysetid');
            (useProjectId as Mock).mockReturnValue('projectid');
            (useUserCanEdit as Mock).mockReturnValue(true);

            (useGetStudysetById as Mock).mockReturnValue({
                data: { studies: [{ id: 'study-2' }, { id: 'study-3' }, { id: 'study-4' }] },
            });

            render(<EditStudyToolbar />);
            // ACT
            userEvent.click(screen.getByTestId('KeyboardArrowLeftIcon'));
            // ASSERT
            expect(useNavigate()).toHaveBeenCalledWith(
                '/projects/projectid/extraction/studies/study-2/edit'
            );
        });

        it('should disable the back button if on the first study', () => {
            // ARRANGE
            (useStudyId as Mock).mockReturnValue('study-2');
            (useProjectExtractionStudysetId as Mock).mockReturnValue('studysetid');
            (useProjectId as Mock).mockReturnValue('projectid');
            (useUserCanEdit as Mock).mockReturnValue(true);

            (useGetStudysetById as Mock).mockReturnValue({
                data: { studies: [{ id: 'study-2' }, { id: 'study-3' }, { id: 'study-4' }] },
            });

            render(<EditStudyToolbar />);
            // ACT
            const arrowBackIcon = screen.getByTestId('KeyboardArrowLeftIcon').parentElement;
            // ASSERT
            expect(arrowBackIcon).toBeDisabled();
        });
    });

    describe('next button', () => {
        it('should move to the next study when receiving state from the table', () => {
            // ARRANGE
            window.sessionStorage.setItem(
                `projectid-extraction-table`,
                JSON.stringify({
                    columnFilters: [],
                    sorting: [],
                    studies: ['study-1', 'study-2', 'study-3', 'study-4'],
                })
            );
            (useStudyId as Mock).mockReturnValue('study-2');
            (useProjectExtractionStudysetId as Mock).mockReturnValue('studysetid');
            (useProjectId as Mock).mockReturnValue('projectid');
            (useUserCanEdit as Mock).mockReturnValue(true);

            render(<EditStudyToolbar />);
            // ACT
            userEvent.click(screen.getByTestId('KeyboardArrowRightIcon'));
            // ASSERT
            expect(useNavigate()).toHaveBeenCalledWith(
                '/projects/projectid/extraction/studies/study-3/edit'
            );
        });

        it('should show a popup if there are unsaved changes when going to next', () => {
            // ARRANGE
            window.sessionStorage.setItem(
                `projectid-extraction-table`,
                JSON.stringify({
                    columnFilters: [],
                    sorting: [],
                    studies: ['study-1', 'study-2', 'study-3', 'study-4'],
                })
            );
            setUnloadHandler('study'); // simulate an unsaved change
            (useStudyId as Mock).mockReturnValue('study-2');
            (useProjectExtractionStudysetId as Mock).mockReturnValue('studysetid');
            (useProjectId as Mock).mockReturnValue('projectid');
            (useUserCanEdit as Mock).mockReturnValue(true);

            render(<EditStudyToolbar />);
            // ACT
            userEvent.click(screen.getByTestId('KeyboardArrowRightIcon'));
            // ASSERT
            expect(useNavigate()).not.toHaveBeenCalledWith(
                '/projects/projectid/extraction/studies/study-3/edit'
            );
            expect(screen.getByTestId('mock-confirmation-dialog')).toBeInTheDocument();
        });

        it('should move to the next study if there is no state received from the table', () => {
            // ARRANGE
            (useStudyId as Mock).mockReturnValue('study-3');
            (useProjectExtractionStudysetId as Mock).mockReturnValue('studysetid');
            (useProjectId as Mock).mockReturnValue('projectid');
            (useUserCanEdit as Mock).mockReturnValue(true);

            (useGetStudysetById as Mock).mockReturnValue({
                data: { studies: [{ id: 'study-2' }, { id: 'study-3' }, { id: 'study-4' }] },
            });

            render(<EditStudyToolbar />);
            // ACT
            userEvent.click(screen.getByTestId('KeyboardArrowRightIcon'));
            // ASSERT
            expect(useNavigate()).toHaveBeenCalledWith(
                '/projects/projectid/extraction/studies/study-4/edit'
            );
        });

        it('should disable the next button if on the last study', () => {
            // ARRANGE
            window.sessionStorage.setItem(
                `projectid-extraction-table`,
                JSON.stringify({
                    columnFilters: [],
                    sorting: [],
                    studies: ['study-1', 'study-2', 'study-3', 'study-4'],
                })
            );
            (useStudyId as Mock).mockReturnValue('study-4');
            (useProjectExtractionStudysetId as Mock).mockReturnValue('studysetid');
            (useProjectId as Mock).mockReturnValue('projectid');
            (useUserCanEdit as Mock).mockReturnValue(true);

            render(<EditStudyToolbar />);
            // ACT
            const arrowForwardIcon = screen.getByTestId('KeyboardArrowRightIcon').parentElement;
            // ASSERT
            expect(arrowForwardIcon).toBeDisabled();
        });
    });
});

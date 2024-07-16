import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useGetExtractionSummary, useGetStudysetById } from 'hooks';
import { IStudyExtractionStatus } from 'hooks/projects/useGetProjects';
import { EExtractionStatus } from 'pages/Extraction/ExtractionPage';
import {
    useProjectExtractionAddOrUpdateStudyListStatus,
    useProjectExtractionStudyStatusList,
} from 'pages/Project/store/ProjectStore';
import { useStudyId } from 'pages/Study/store/StudyStore';
import { useNavigate } from 'react-router-dom';
import EditStudyToolbar from './EditStudyToolbar';
import { useUserCanEdit } from 'hooks';

jest.mock('hooks');
jest.mock('react-router-dom');
jest.mock('pages/Project/store/ProjectStore.ts');
jest.mock('pages/Study/store/StudyStore.ts');

describe('EditStudyToolbar Component', () => {
    it('should render', () => {
        render(<EditStudyToolbar />);
    });

    it.each([
        [0, 0, 0, 0, 0],
        [0, 10, 0, 0, 10],
        [10, 0, 0, 0, 0],
        [7, 14, 50, 7, 14],
    ])(
        'testing completed: %i and total: %i',
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
        expect(useNavigate()).toHaveBeenCalledWith('/projects/project-id/meta-analyses');
    });

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

    it('should move to previous study', () => {
        // ARRANGE
        Storage.prototype.getItem = jest.fn().mockReturnValue(EExtractionStatus.SAVEDFORLATER); // mock localStorage
        (useStudyId as jest.Mock).mockReturnValue('study-2');
        (useUserCanEdit as jest.Mock).mockReturnValue(true);
        useGetStudysetById().data = {
            studies: [{ id: 'study-0' }, { id: 'study-0.5' }, { id: 'study-2' }, { id: 'study-3' }],
        };
        (useProjectExtractionStudyStatusList as jest.Mock).mockReturnValue([
            {
                id: 'study-0',
                status: EExtractionStatus.SAVEDFORLATER,
            },
            {
                id: 'study-0.5',
                status: EExtractionStatus.UNCATEGORIZED,
            },
            {
                id: 'study-1',
                status: EExtractionStatus.COMPLETED,
            },
            {
                id: 'study-2',
                status: EExtractionStatus.SAVEDFORLATER,
            },
            {
                id: 'study-3',
                status: EExtractionStatus.COMPLETED,
            },
        ] as IStudyExtractionStatus[]);

        render(<EditStudyToolbar />);
        // ACT
        userEvent.click(screen.getByTestId('ArrowBackIcon'));
        // ASSERT
        expect(useNavigate()).toHaveBeenCalledWith(
            '/projects/project-id/extraction/studies/study-0/edit'
        );
    });

    it('should disable if no previous study', () => {
        // ARRANGE
        Storage.prototype.getItem = jest.fn().mockReturnValue(EExtractionStatus.SAVEDFORLATER); // mock localStorage
        (useStudyId as jest.Mock).mockReturnValue('study-2');
        useGetStudysetById().data = {
            studies: [{ id: 'study-1' }, { id: 'study-2' }, { id: 'study-3' }],
        };
        (useProjectExtractionStudyStatusList as jest.Mock).mockReturnValue([
            {
                id: 'study-1',
                status: EExtractionStatus.UNCATEGORIZED,
            },
            {
                id: 'study-2',
                status: EExtractionStatus.SAVEDFORLATER,
            },
            {
                id: 'study-3',
                status: EExtractionStatus.COMPLETED,
            },
        ] as IStudyExtractionStatus[]);

        render(<EditStudyToolbar />);
        // ACT
        const arrowBackIcon = screen.getByTestId('ArrowBackIcon').parentElement;
        // ASSERT
        expect(arrowBackIcon).toBeDisabled();
    });

    it('should move to next study', () => {
        // ARRANGE
        Storage.prototype.getItem = jest.fn().mockReturnValue(EExtractionStatus.COMPLETED); // mock localStorage
        (useStudyId as jest.Mock).mockReturnValue('study-2');
        useGetStudysetById().data = {
            studies: [
                { id: 'study-1' },
                { id: 'study-2' },
                { id: 'study-3' },
                { id: 'study-4' },
                { id: 'study-5' },
            ],
        };
        (useProjectExtractionStudyStatusList as jest.Mock).mockReturnValue([
            {
                id: 'study-1',
                status: EExtractionStatus.UNCATEGORIZED,
            },
            {
                id: 'study-2',
                status: EExtractionStatus.COMPLETED,
            },
            {
                id: 'study-3',
                status: EExtractionStatus.SAVEDFORLATER,
            },
            {
                id: 'study-4',
                status: EExtractionStatus.UNCATEGORIZED,
            },
            {
                id: 'study-5',
                status: EExtractionStatus.COMPLETED,
            },
        ] as IStudyExtractionStatus[]);

        render(<EditStudyToolbar />);
        // ACT
        userEvent.click(screen.getByTestId('ArrowForwardIcon'));
        // ASSERT
        expect(useNavigate()).toHaveBeenCalledWith(
            '/projects/project-id/extraction/studies/study-5/edit'
        );
    });

    it('should disable if no next study', () => {
        // ARRANGE
        Storage.prototype.getItem = jest.fn().mockReturnValue(EExtractionStatus.SAVEDFORLATER); // mock localStorage
        (useStudyId as jest.Mock).mockReturnValue('study-2');
        useGetStudysetById().data = {
            studies: [{ id: 'study-1' }, { id: 'study-2' }, { id: 'study-3' }],
        };
        (useProjectExtractionStudyStatusList as jest.Mock).mockReturnValue([
            {
                id: 'study-1',
                status: EExtractionStatus.UNCATEGORIZED,
            },
            {
                id: 'study-2',
                status: EExtractionStatus.SAVEDFORLATER,
            },
            {
                id: 'study-3',
                status: EExtractionStatus.UNCATEGORIZED,
            },
        ] as IStudyExtractionStatus[]);

        render(<EditStudyToolbar />);
        // ACT
        const arrowBackIcon = screen.getByTestId('ArrowForwardIcon').parentElement;
        // ASSERT
        expect(arrowBackIcon).toBeDisabled();
    });
});

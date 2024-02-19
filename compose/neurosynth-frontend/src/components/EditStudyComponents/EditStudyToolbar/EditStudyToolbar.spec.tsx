import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useGetExtractionSummary, useGetStudysetById } from 'hooks';
import { EExtractionStatus } from 'pages/ExtractionPage/ExtractionPage';
import {
    useProjectExtractionAddOrUpdateStudyListStatus,
    useProjectExtractionStudyStatusList,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { Router } from 'react-router-dom';
import EditStudyToolbar from './EditStudyToolbar';
import { IStudyExtractionStatus } from 'hooks/projects/useGetProjects';
import { useStudyId } from 'pages/Studies/StudyStore';

jest.mock('hooks');
jest.mock('pages/Projects/ProjectPage/ProjectStore.ts');
jest.mock('pages/Studies/StudyStore.ts');

describe('EditStudyToolbar Component', () => {
    const historyMock = {
        push: jest.fn(),
        location: {},
        listen: jest.fn(),
    };

    it('should render', () => {
        render(
            <Router history={historyMock as any}>
                <EditStudyToolbar />
            </Router>
        );
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
            render(
                <Router history={historyMock as any}>
                    <EditStudyToolbar />
                </Router>
            );
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
        render(
            <Router history={historyMock as any}>
                <EditStudyToolbar />
            </Router>
        );
        expect(screen.getByTestId('DoneAllIcon')).toBeInTheDocument();
    });

    it('should move on to the specification phase', () => {
        useGetExtractionSummary('').completed = 21;
        useGetExtractionSummary('').total = 21;
        render(
            <Router history={historyMock as any}>
                <EditStudyToolbar />
            </Router>
        );
        userEvent.click(screen.getByTestId('DoneAllIcon'));
        expect(historyMock.push).toHaveBeenCalledWith('/projects/project-id/meta-analyses');
    });

    it('should set to completed', () => {
        render(
            <Router history={historyMock as any}>
                <EditStudyToolbar />
            </Router>
        );
        const checkIcon = screen.getByTestId('CheckIcon');
        userEvent.click(checkIcon);
        expect(useProjectExtractionAddOrUpdateStudyListStatus()).toHaveBeenCalledWith(
            'study-id',
            EExtractionStatus.COMPLETED
        );
    });

    it('should set to saved for later', () => {
        render(
            <Router history={historyMock as any}>
                <EditStudyToolbar />
            </Router>
        );
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

        render(
            <Router history={historyMock as any}>
                <EditStudyToolbar />
            </Router>
        );
        // ACT
        userEvent.click(screen.getByTestId('ArrowBackIcon'));
        // ASSERT
        expect(historyMock.push).toHaveBeenCalledWith(
            '/projects/project-id/extraction/studies/study-0'
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

        render(
            <Router history={historyMock as any}>
                <EditStudyToolbar />
            </Router>
        );
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

        render(
            <Router history={historyMock as any}>
                <EditStudyToolbar />
            </Router>
        );
        // ACT
        userEvent.click(screen.getByTestId('ArrowForwardIcon'));
        // ASSERT
        expect(historyMock.push).toHaveBeenCalledWith(
            '/projects/project-id/extraction/studies/study-5'
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

        render(
            <Router history={historyMock as any}>
                <EditStudyToolbar />
            </Router>
        );
        // ACT
        const arrowBackIcon = screen.getByTestId('ArrowForwardIcon').parentElement;
        // ASSERT
        expect(arrowBackIcon).toBeDisabled();
    });
});

import { vi, Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import DisplayExtractionTableState from './DisplayExtractionTableState';
import { retrieveExtractionTableState } from 'pages/Extraction/components/ExtractionTable.helpers';
import { useStudyId } from 'pages/Study/store/StudyStore';
import { useGetStudyById } from 'hooks';
import userEvent from '@testing-library/user-event';
import { useNavigate } from 'react-router-dom';
import { setUnloadHandler } from 'helpers/BeforeUnload.helpers';

vi.mock('pages/Project/store/ProjectStore');
vi.mock('pages/Study/store/StudyStore');
vi.mock('components/Dialogs/ConfirmationDialog');
vi.mock('hooks');
vi.mock('pages/Extraction/components/ExtractionTable.helpers');
vi.mock('react-router-dom');

describe('DisplayExtractionTableState Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (retrieveExtractionTableState as Mock).mockReturnValue({
            columnFilters: [],
            studies: ['study-1', 'study-2', 'study-3'],
            sorting: [],
        });

        (useGetStudyById as Mock).mockImplementation((studyId: string) => ({
            isLoading: false,
            data: {
                name: studyId,
            },
        }));
    });

    it('should render', async () => {
        render(<DisplayExtractionTableState />);
    });

    it('should render the previous navigation button', async () => {
        (useStudyId as Mock).mockReturnValue('study-2');

        render(<DisplayExtractionTableState />);

        expect(screen.getByText('study-1')).toBeInTheDocument();
    });

    it('should render the next navigation button', async () => {
        (useStudyId as Mock).mockReturnValue('study-2');

        render(<DisplayExtractionTableState />);

        expect(screen.getByText('study-3')).toBeInTheDocument();
    });

    it('navigates to the previous study', async () => {
        (useStudyId as Mock).mockReturnValue('study-2');

        render(<DisplayExtractionTableState />);

        expect(screen.getByText('study-1')).toBeInTheDocument();
        await userEvent.click(screen.getByText('study-1'));

        expect(useNavigate()).toHaveBeenCalledWith('/projects/project-id/extraction/studies/study-1/edit');
    });

    it('navigates to the next study', async () => {
        (useStudyId as Mock).mockReturnValue('study-2');

        render(<DisplayExtractionTableState />);

        expect(screen.getByText('study-3')).toBeInTheDocument();
        await userEvent.click(screen.getByText('study-3'));

        expect(useNavigate()).toHaveBeenCalledWith('/projects/project-id/extraction/studies/study-3/edit');
    });

    it('should not show the previous button if there is no previous study', async () => {
        (useStudyId as Mock).mockReturnValue('study-1');

        render(<DisplayExtractionTableState />);

        expect(screen.getAllByRole('button').length).toEqual(1);
    });

    it('should not show the next button if there is no previous study', async () => {
        (useStudyId as Mock).mockReturnValue('study-3');

        render(<DisplayExtractionTableState />);

        expect(screen.getAllByRole('button').length).toEqual(1);
    });

    it('shows the confirmation dialog', async () => {
        (useStudyId as Mock).mockReturnValue('study-1');
        setUnloadHandler('study');
        render(<DisplayExtractionTableState />);

        await userEvent.click(screen.getByText('study-2'));
        expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
    });

    it('should navigate after confirming the dialog', async () => {
        (useStudyId as Mock).mockReturnValue('study-1');
        setUnloadHandler('study');
        render(<DisplayExtractionTableState />);

        await userEvent.click(screen.getByText('study-2'));
        expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();

        await userEvent.click(screen.getByTestId('accept-close-confirmation'));
        expect(useNavigate()).toHaveBeenCalledWith('/projects/project-id/extraction/studies/study-2/edit');
    });

    it('should not navigate after cancelling the dialog', async () => {
        (useStudyId as Mock).mockReturnValue('study-1');
        setUnloadHandler('annotation');
        render(<DisplayExtractionTableState />);

        await userEvent.click(screen.getByText('study-2'));
        expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();

        await userEvent.click(screen.getByTestId('deny-close-confirmation'));
        expect(useNavigate()).not.toHaveBeenCalled();
    });
});

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCreateStudy, useUpdateAnnotationById, useUpdateStudyset } from 'hooks';
import { useSnackbar } from 'notistack';
import {
    useStudy,
    useStudyAnalyses,
    useStudyHasBeenEdited,
    useStudyUser,
    useUpdateStudyInDB,
} from 'pages/Study/store/StudyStore';
import { useUpdateAnnotationInDB } from 'stores/AnnotationStore.actions';
import { useAnnotationIsEdited, useAnnotationNotes } from 'stores/AnnotationStore.getters';
import {
    mockAnalyses,
    mockAnnotations,
    mockStorePoints,
    mockStoreStudy,
    mockStudy,
    mockStudysetNotNested,
} from 'testing/mockData';
import useSaveStudy from './useSaveStudy';

jest.mock('react-query');
jest.mock('@auth0/auth0-react');
jest.mock('notistack');
jest.mock('react-router-dom');
jest.mock('pages/Project/store/ProjectStore');
jest.mock('pages/Study/store/StudyStore');
jest.mock('stores/AnnotationStore.getters');
jest.mock('stores/AnnotationStore.actions');
jest.mock('hooks');
jest.mock('utils/api');

// Using a dummy component in order to test a custom hook
const DummyComponent = () => {
    const { isLoading, hasEdits, handleSave } = useSaveStudy();
    return (
        <div>
            <div data-testid="save-study-is-loading">{isLoading}</div>
            <div data-testid="save-study-has-edits">{hasEdits}</div>
            <button data-testid="save-study-button" onClick={handleSave}></button>
        </div>
    );
};

describe('useSaveStudy hook', () => {
    it('should render', () => {
        render(<DummyComponent />);
    });

    it('should throw an error for duplicate analyses', async () => {
        const mockAnalysesWithDuplicates = mockAnalyses();
        (useStudyAnalyses as jest.Mock).mockReturnValue([
            ...mockAnalysesWithDuplicates,
            mockAnalysesWithDuplicates[0],
        ]);

        render(<DummyComponent />);

        await act(async () => {
            userEvent.click(screen.getByTestId('save-study-button'));
        });

        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalled();
        expect(useUpdateAnnotationInDB()).not.toHaveBeenCalled();
        expect(useUpdateStudyInDB()).not.toHaveBeenCalled();
    });

    it('should throw an error for empty study points', async () => {
        const mockAnalysesWithoutPoints = mockAnalyses();
        mockAnalysesWithoutPoints[0].points = [
            {
                x: undefined,
                y: undefined,
                z: undefined,
            },
            {
                x: undefined,
                y: undefined,
                z: undefined,
            },
        ];

        (useStudyAnalyses as jest.Mock).mockReturnValue(mockAnalysesWithoutPoints);

        render(<DummyComponent />);

        await act(async () => {
            userEvent.click(screen.getByTestId('save-study-button'));
        });

        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalled();
        expect(useUpdateAnnotationInDB()).not.toHaveBeenCalled();
        expect(useUpdateStudyInDB()).not.toHaveBeenCalled();
    });

    it('should save the study and annotation when both have been edited', async () => {
        const mockAnalysesWithXYZ = mockAnalyses();
        mockAnalysesWithXYZ[0].points = mockStorePoints();
        (useStudyAnalyses as jest.Mock).mockReturnValue(mockAnalysesWithXYZ);
        (useStudyHasBeenEdited as jest.Mock).mockReturnValue(true);
        (useAnnotationIsEdited as jest.Mock).mockReturnValue(true);

        render(<DummyComponent />);

        await act(async () => {
            userEvent.click(screen.getByTestId('save-study-button'));
        });

        expect(useUpdateStudyInDB()).toHaveBeenCalled();
        expect(useUpdateAnnotationInDB()).toHaveBeenCalled();
    });

    it('should only save the study if the annotation has not been edited', async () => {
        const mockAnalysesWithXYZ = mockAnalyses();
        mockAnalysesWithXYZ[0].points = mockStorePoints();
        (useStudyAnalyses as jest.Mock).mockReturnValue(mockAnalysesWithXYZ);
        (useStudyHasBeenEdited as jest.Mock).mockReturnValue(true);
        (useAnnotationIsEdited as jest.Mock).mockReturnValue(false);

        render(<DummyComponent />);

        await act(async () => {
            userEvent.click(screen.getByTestId('save-study-button'));
        });

        expect(useUpdateStudyInDB()).toHaveBeenCalled();
        expect(useUpdateAnnotationInDB()).not.toHaveBeenCalled();
    });

    it('should only save the annotation if the study has not been edited', async () => {
        const mockAnalysesWithXYZ = mockAnalyses();
        mockAnalysesWithXYZ[0].points = mockStorePoints();
        (useStudyAnalyses as jest.Mock).mockReturnValue(mockAnalysesWithXYZ);
        (useStudyHasBeenEdited as jest.Mock).mockReturnValue(false);
        (useAnnotationIsEdited as jest.Mock).mockReturnValue(true);

        render(<DummyComponent />);

        await act(async () => {
            userEvent.click(screen.getByTestId('save-study-button'));
        });

        expect(useUpdateStudyInDB()).not.toHaveBeenCalled();
        expect(useUpdateAnnotationInDB()).toHaveBeenCalled();
    });

    it('should clone the study if user does not own the study and it has been edited', async () => {
        const nestedMockStudyset = mockStudysetNotNested();
        const mockStudyWithSameIdInStudyset = mockStoreStudy();
        mockStudyWithSameIdInStudyset.id = (nestedMockStudyset.studies as string[])[0];
        (useStudy as jest.Mock).mockReturnValue(mockStudyWithSameIdInStudyset);
        (useStudyHasBeenEdited as jest.Mock).mockReturnValue(true);
        (useStudyUser as jest.Mock).mockReturnValue('different-user');
        (useAnnotationNotes as jest.Mock).mockReturnValue(mockAnnotations()[0].notes);
        const mockAnalysesWithXYZ = mockAnalyses();
        mockAnalysesWithXYZ[0].points = mockStorePoints();
        (useStudyAnalyses as jest.Mock).mockReturnValue(mockAnalysesWithXYZ);

        render(<DummyComponent />);

        await act(async () => {
            userEvent.click(screen.getByTestId('save-study-button'));
        });

        expect(useUpdateStudyInDB()).not.toHaveBeenCalled();
        expect(useCreateStudy().mutateAsync).toHaveBeenCalled();
        expect(useUpdateStudyset().mutateAsync).toHaveBeenCalled();
        expect(useUpdateAnnotationById('').mutateAsync).toHaveBeenCalled(); // arg doesnt matter as it is a mock
    });
});

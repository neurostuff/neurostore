import { vi, Mock } from 'vitest';
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
    mockStudysetNotNested,
} from 'testing/mockData';
import useSaveStudy from './useSaveStudy';

vi.mock('react-query');
vi.mock('@auth0/auth0-react');
vi.mock('notistack');
vi.mock('react-router-dom');
vi.mock('pages/Project/store/ProjectStore');
vi.mock('pages/Study/store/StudyStore');
vi.mock('stores/AnnotationStore.getters');
vi.mock('stores/AnnotationStore.actions');
vi.mock('hooks');
vi.mock('api/api.config');

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
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it('should render', () => {
        render(<DummyComponent />);
    });

    it('should throw an error for duplicate analyses', async () => {
        const mockAnalysesWithDuplicates = mockAnalyses();
        (useStudyAnalyses as Mock).mockReturnValue([...mockAnalysesWithDuplicates, mockAnalysesWithDuplicates[0]]);

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

        (useStudyAnalyses as Mock).mockReturnValue(mockAnalysesWithoutPoints);

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
        (useStudyAnalyses as Mock).mockReturnValue(mockAnalysesWithXYZ);
        (useStudyHasBeenEdited as Mock).mockReturnValue(true);
        (useAnnotationIsEdited as Mock).mockReturnValue(true);

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
        (useStudyAnalyses as Mock).mockReturnValue(mockAnalysesWithXYZ);
        (useStudyHasBeenEdited as Mock).mockReturnValue(true);
        (useAnnotationIsEdited as Mock).mockReturnValue(false);

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
        (useStudyAnalyses as Mock).mockReturnValue(mockAnalysesWithXYZ);
        (useStudyHasBeenEdited as Mock).mockReturnValue(false);
        (useAnnotationIsEdited as Mock).mockReturnValue(true);

        render(<DummyComponent />);

        await act(async () => {
            userEvent.click(screen.getByTestId('save-study-button'));
        });

        expect(useUpdateStudyInDB()).not.toHaveBeenCalled();
        expect(useUpdateAnnotationInDB()).toHaveBeenCalled();
    });

    it('should clone the study if user does not own the study and it has been edited', async () => {
        const nonNestedMockStudyset = mockStudysetNotNested();
        const mockStudyWithSameIdInStudyset = mockStoreStudy();
        mockStudyWithSameIdInStudyset.id = (nonNestedMockStudyset.studies as string[])[0];
        (useStudy as Mock).mockReturnValue(mockStudyWithSameIdInStudyset);
        (useStudyHasBeenEdited as Mock).mockReturnValue(true);
        (useStudyUser as Mock).mockReturnValue('different-user');
        (useAnnotationNotes as Mock).mockReturnValue(mockAnnotations()[0].notes);
        const mockAnalysesWithXYZ = mockAnalyses();
        mockAnalysesWithXYZ[0].points = mockStorePoints();
        (useStudyAnalyses as Mock).mockReturnValue(mockAnalysesWithXYZ);

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

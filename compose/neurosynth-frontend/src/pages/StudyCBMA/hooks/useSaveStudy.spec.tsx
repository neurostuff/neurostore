import { vi, Mock } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQueryClient } from '@tanstack/react-query';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import {
    useCreateStudy,
    useUpdateAnnotationByAnnotationAndAnalysisIds,
    useUpdateAnnotationById,
    useUpdateStudyset,
} from 'hooks';
import { useSnackbar } from 'notistack';
import { StudyAnnotationEdits, StudyAnnotationsTableHandle } from 'pages/StudyCBMA/context/StudyCBMAContext';
import { useNavigate } from 'react-router-dom';
import {
    useStudy,
    useStudyAnalyses,
    useStudyHasBeenEdited,
    useStudyUser,
    useUpdateStudyInDB,
} from 'stores/study/StudyStore';
import { mockAnalyses, mockStorePoints, mockStoreStudy, mockStudysetNotNested } from 'testing/mockData';
import useSaveStudy from './useSaveStudy';

vi.mock('@tanstack/react-query');
vi.mock('@auth0/auth0-react');
vi.mock('notistack');
vi.mock('react-router-dom');
vi.mock('stores/projects/ProjectStore');
vi.mock('stores/study/StudyStore');
vi.mock('hooks');
vi.mock('api/api.config');

const setAnnotationHasEdits = vi.fn();

// Using a dummy component in order to test a custom hook
const DummyComponent = (props: {
    studyAnnotationsTable?: StudyAnnotationsTableHandle;
    annotationHasEdits?: boolean;
}) => {
    const { isLoading, hasEdits, handleSave } = useSaveStudy(
        { current: props.studyAnnotationsTable ?? null },
        props.annotationHasEdits ?? false,
        setAnnotationHasEdits
    );
    return (
        <div>
            <div data-testid="save-study-is-loading">{isLoading}</div>
            <div data-testid="save-study-has-edits">{hasEdits}</div>
            <button data-testid="save-study-button" onClick={handleSave}></button>
        </div>
    );
};

const createStudyAnnotationsTable = (annotationEdits?: StudyAnnotationEdits): StudyAnnotationsTableHandle => ({
    getAnnotationEdits: vi.fn().mockReturnValue(annotationEdits),
    markSaved: vi.fn(),
    insertAnalysisRow: vi.fn(),
    removeAnalysisRow: vi.fn(),
    updateAnalysisDetails: vi.fn(),
});

const createAnnotationEdits = (annotationEditsOverride?: Partial<StudyAnnotationEdits>): StudyAnnotationEdits => ({
    noteKeys: [{ key: 'included', type: EPropertyType.BOOLEAN, order: 0, default: true }],
    rows: [
        { analysis: 'analysis-1', study: 'study-id', isNew: false, note: { included: true } },
        { analysis: 'analysis-2', study: 'study-id', isNew: false, note: { included: false } },
    ],
    editedRowIndexes: new Set([1]),
    noteKeysHaveChanged: false,
    ...annotationEditsOverride,
});

const clickSave = async () => {
    await act(async () => {
        await userEvent.click(screen.getByTestId('save-study-button'));
    });
};

describe('useSaveStudy hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        const mockAnalysesWithXYZ = mockAnalyses();
        mockAnalysesWithXYZ[0].points = mockStorePoints();
        (useStudyAnalyses as Mock).mockReturnValue(mockAnalysesWithXYZ);
        (useStudyHasBeenEdited as Mock).mockReturnValue(false);
        (useStudyUser as Mock).mockReturnValue('some-github-user');
        (useUpdateStudyInDB as Mock).mockReturnValue(vi.fn().mockResolvedValue({ analyses: [] }));
    });

    it('should render', async () => {
        render(<DummyComponent />);
    });

    it('should throw an error for duplicate analyses', async () => {
        const mockAnalysesWithDuplicates = mockAnalyses();
        (useStudyAnalyses as Mock).mockReturnValue([...mockAnalysesWithDuplicates, mockAnalysesWithDuplicates[0]]);
        (useStudyHasBeenEdited as Mock).mockReturnValue(true);

        render(<DummyComponent studyAnnotationsTable={createStudyAnnotationsTable(createAnnotationEdits())} />);
        await clickSave();

        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalled();
        expect(useUpdateAnnotationByAnnotationAndAnalysisIds('').mutateAsync).not.toHaveBeenCalled();
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
        (useStudyHasBeenEdited as Mock).mockReturnValue(true);

        render(<DummyComponent studyAnnotationsTable={createStudyAnnotationsTable(createAnnotationEdits())} />);
        await clickSave();

        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalled();
        expect(useUpdateAnnotationByAnnotationAndAnalysisIds('').mutateAsync).not.toHaveBeenCalled();
        expect(useUpdateStudyInDB()).not.toHaveBeenCalled();
    });

    it('should POST only the edited rows when the note keys have not changed', async () => {
        const studyAnnotationsTable = createStudyAnnotationsTable(createAnnotationEdits());

        render(<DummyComponent studyAnnotationsTable={studyAnnotationsTable} annotationHasEdits />);
        await clickSave();

        expect(useUpdateStudyInDB()).not.toHaveBeenCalled();
        expect(useUpdateAnnotationById('').mutateAsync).not.toHaveBeenCalled();
        expect(useUpdateAnnotationByAnnotationAndAnalysisIds('').mutateAsync).toHaveBeenCalledWith([
            { id: 'annotation-id_analysis-2', note: { included: false } },
        ]);
        expect(studyAnnotationsTable.markSaved).toHaveBeenCalled();
        expect(setAnnotationHasEdits).toHaveBeenCalledWith(false);
        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith('Annotation saved', { variant: 'success' });
    });

    it('should PUT the whole annotation when the note keys have changed', async () => {
        const studyAnnotationsTable = createStudyAnnotationsTable(
            createAnnotationEdits({ noteKeysHaveChanged: true, editedRowIndexes: new Set() })
        );

        render(<DummyComponent studyAnnotationsTable={studyAnnotationsTable} annotationHasEdits />);
        await clickSave();

        expect(useUpdateAnnotationByAnnotationAndAnalysisIds('').mutateAsync).not.toHaveBeenCalled();
        expect(useUpdateAnnotationById('').mutateAsync).toHaveBeenCalledWith({
            argAnnotationId: 'annotation-id',
            annotation: {
                note_keys: { included: { type: EPropertyType.BOOLEAN, order: 0, default: true } },
                notes: [
                    { analysis: 'analysis-1', study: 'study-id', note: { included: true } },
                    { analysis: 'analysis-2', study: 'study-id', note: { included: false } },
                ],
            },
        });
        expect(studyAnnotationsTable.markSaved).toHaveBeenCalled();
    });

    it('should save the study and annotation when both have been edited', async () => {
        (useStudyHasBeenEdited as Mock).mockReturnValue(true);

        render(
            <DummyComponent
                studyAnnotationsTable={createStudyAnnotationsTable(createAnnotationEdits())}
                annotationHasEdits
            />
        );
        await clickSave();

        expect(useUpdateStudyInDB()).toHaveBeenCalled();
        expect(useUpdateAnnotationByAnnotationAndAnalysisIds('').mutateAsync).toHaveBeenCalled();
        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith('Study and annotation saved', {
            variant: 'success',
        });
    });

    it('should only save the study if the annotation has not been edited', async () => {
        (useStudyHasBeenEdited as Mock).mockReturnValue(true);

        render(
            <DummyComponent
                studyAnnotationsTable={createStudyAnnotationsTable(
                    createAnnotationEdits({ editedRowIndexes: new Set() })
                )}
            />
        );
        await clickSave();

        expect(useUpdateStudyInDB()).toHaveBeenCalled();
        expect(useUpdateAnnotationByAnnotationAndAnalysisIds('').mutateAsync).not.toHaveBeenCalled();
        expect(useUpdateAnnotationById('').mutateAsync).not.toHaveBeenCalled();
        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith('Study saved', { variant: 'success' });
    });

    it('should use the saved analysis id for a new analysis row', async () => {
        const mockAnalysesWithNewAnalysis = mockAnalyses();
        mockAnalysesWithNewAnalysis[0].points = mockStorePoints();
        mockAnalysesWithNewAnalysis.push({ id: 'temporary-id', name: 'new analysis', points: [] });
        (useStudyAnalyses as Mock).mockReturnValue(mockAnalysesWithNewAnalysis);
        (useStudyHasBeenEdited as Mock).mockReturnValue(true);
        (useUpdateStudyInDB as Mock).mockReturnValue(
            vi.fn().mockResolvedValue({ analyses: [{ id: 'saved-id', name: 'new analysis' }] })
        );
        const studyAnnotationsTable = createStudyAnnotationsTable(
            createAnnotationEdits({
                rows: [{ analysis: 'temporary-id', study: 'study-id', isNew: true, note: { included: false } }],
                editedRowIndexes: new Set([0]),
            })
        );

        render(<DummyComponent studyAnnotationsTable={studyAnnotationsTable} annotationHasEdits />);
        await clickSave();

        expect(useUpdateAnnotationByAnnotationAndAnalysisIds('').mutateAsync).toHaveBeenCalledWith([
            { id: 'annotation-id_saved-id', note: { included: false } },
        ]);
        expect(studyAnnotationsTable.markSaved).toHaveBeenCalledWith(new Map([['temporary-id', 'saved-id']]));
    });

    it('should not mark the annotation as saved until the request resolves', async () => {
        let resolveRequest: (value: unknown) => void = () => {};
        (useUpdateAnnotationByAnnotationAndAnalysisIds('').mutateAsync as Mock).mockReturnValueOnce(
            new Promise((resolve) => {
                resolveRequest = resolve;
            })
        );
        const studyAnnotationsTable = createStudyAnnotationsTable(createAnnotationEdits());

        render(<DummyComponent studyAnnotationsTable={studyAnnotationsTable} annotationHasEdits />);
        await clickSave();

        expect(useUpdateAnnotationByAnnotationAndAnalysisIds('').mutateAsync).toHaveBeenCalled();
        expect(studyAnnotationsTable.markSaved).not.toHaveBeenCalled();
        expect(useSnackbar().enqueueSnackbar).not.toHaveBeenCalledWith('Annotation saved', { variant: 'success' });

        await act(async () => {
            resolveRequest({});
        });

        expect(studyAnnotationsTable.markSaved).toHaveBeenCalled();
        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith('Annotation saved', { variant: 'success' });
    });

    it('should clone the study if user does not own the study and it has been edited', async () => {
        const nonNestedMockStudyset = mockStudysetNotNested();
        const mockStudyWithSameIdInStudyset = mockStoreStudy();
        mockStudyWithSameIdInStudyset.id = (nonNestedMockStudyset.studies as string[])[0];
        (useStudy as Mock).mockReturnValue(mockStudyWithSameIdInStudyset);
        (useStudyHasBeenEdited as Mock).mockReturnValue(true);
        (useStudyUser as Mock).mockReturnValue('different-user');
        // the cloned study returned by the API mock has the same analysis names with new ids
        const mockAnalysesWithXYZ = mockAnalyses();
        mockAnalysesWithXYZ[0].points = mockStorePoints();
        mockAnalysesWithXYZ[0].id = 'original-analysis-id';
        (useStudyAnalyses as Mock).mockReturnValue(mockAnalysesWithXYZ);
        const studyAnnotationsTable = createStudyAnnotationsTable(
            createAnnotationEdits({
                rows: [
                    {
                        analysis: 'original-analysis-id',
                        study: mockStudyWithSameIdInStudyset.id,
                        isNew: false,
                        note: { included: false },
                    },
                ],
                editedRowIndexes: new Set([0]),
            })
        );

        render(<DummyComponent studyAnnotationsTable={studyAnnotationsTable} annotationHasEdits />);
        await clickSave();

        expect(useUpdateStudyInDB()).not.toHaveBeenCalled();
        expect(useCreateStudy().mutateAsync).toHaveBeenCalled();
        expect(useUpdateStudyset().mutateAsync).toHaveBeenCalled();
        expect(useUpdateAnnotationByAnnotationAndAnalysisIds('').mutateAsync).toHaveBeenCalledWith([
            { id: `annotation-id_${mockAnalyses()[0].id}`, note: { included: false } },
        ]);

        const refetchQueries = useQueryClient().refetchQueries as Mock;
        const navigate = useNavigate() as Mock;
        expect(refetchQueries).toHaveBeenCalled();
        expect(navigate).toHaveBeenCalled();
        expect(refetchQueries.mock.invocationCallOrder[0]).toBeLessThan(navigate.mock.invocationCallOrder[0]);
    });
});

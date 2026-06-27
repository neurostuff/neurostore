import { act, renderHook } from '@testing-library/react-hooks';
import {
    useCreateStudy,
    useGetAnnotationById,
    useGetStudysetNonNestedById,
    useUpdateAnnotationByAnnotationAndAnalysisIds,
    useUpdateStudyset,
} from 'hooks';
import { updateExtractionTableStateStudySwapInStorage } from 'pages/Extraction/components/ExtractionTable.helpers';
import {
    useProjectExtractionAnnotationId,
    useProjectExtractionReplaceStudyListStatusId,
    useProjectExtractionStudysetId,
} from 'stores/projects/ProjectStore';
import { useParams } from 'react-router-dom';
import { Mock, vi } from 'vitest';
import useCloneStudy from './useCloneStudy';
import { StudyRequest } from 'neurostore-typescript-sdk';

vi.mock('react-router-dom');
vi.mock('stores/projects/ProjectStore');
vi.mock('hooks');
vi.mock('pages/Extraction/components/ExtractionTable.helpers');

const sourceStudyId = 'source-study-id';
const clonedStudyId = 'cloned-study-id';
const projectId = 'project-id';
const studysetId = 'studyset-id';
const annotationId = 'annotation-id';

const clonedStudy = {
    id: clonedStudyId,
    analyses: [
        {
            id: 'cloned-analysis-1',
            name: 'Motor contrast',
            order: 1,
            study: clonedStudyId,
            images: [],
        },
    ],
};

const studysetWithSourceStudy = {
    studies: [sourceStudyId, 'other-study'],
    studyset_studies: [
        { id: sourceStudyId, curation_stub_uuid: 'stub-1' },
        { id: 'other-study', curation_stub_uuid: 'stub-2' },
    ],
};

const annotationWithNotes = {
    notes: [
        {
            study: sourceStudyId,
            analysis_name: 'Motor contrast',
            analysis: 'old-analysis-id',
            note: { included: true },
        },
    ],
};

const mutateAsync = (hook: Mock) => hook.mock.results[0].value.mutateAsync as Mock;

describe('useCloneStudy', () => {
    const mockReplaceStudyWithNewClonedStudy = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        (useParams as Mock).mockReturnValue({ projectId, studyId: sourceStudyId });
        (useProjectExtractionStudysetId as Mock).mockReturnValue(studysetId);
        (useProjectExtractionAnnotationId as Mock).mockReturnValue(annotationId);
        (useProjectExtractionReplaceStudyListStatusId as Mock).mockReturnValue(mockReplaceStudyWithNewClonedStudy);

        (useCreateStudy as Mock).mockReturnValue({
            isLoading: false,
            mutateAsync: vi.fn().mockResolvedValue({ data: clonedStudy }),
        });
        (useUpdateStudyset as Mock).mockReturnValue({
            isLoading: false,
            mutateAsync: vi.fn().mockResolvedValue({}),
        });
        (useUpdateAnnotationByAnnotationAndAnalysisIds as Mock).mockReturnValue({
            isLoading: false,
            mutateAsync: vi.fn().mockResolvedValue({}),
        });
        (useGetAnnotationById as Mock).mockReturnValue({
            isLoading: false,
            data: annotationWithNotes,
        });
        (useGetStudysetNonNestedById as Mock).mockReturnValue({
            isLoading: false,
            data: studysetWithSourceStudy,
        });
    });

    it('creates a clone, updates the studyset, reapplies annotations, and updates project/session state', async () => {
        const studyRequest = { name: 'Cloned title' };
        const { result } = renderHook(() => useCloneStudy());

        let returnedStudy: StudyRequest | undefined;
        await act(async () => {
            returnedStudy = await result.current.cloneStudy(studyRequest);
        });

        expect(returnedStudy).toEqual(clonedStudy);
        expect(mutateAsync(useCreateStudy as Mock)).toHaveBeenCalledWith({
            sourceId: sourceStudyId,
            data: studyRequest,
        });
        expect(mutateAsync(useUpdateStudyset as Mock)).toHaveBeenCalledWith({
            studysetId,
            studyset: {
                studies: [
                    { id: clonedStudyId, curation_stub_uuid: 'stub-1' },
                    { id: 'other-study', curation_stub_uuid: 'stub-2' },
                ],
            },
        });
        expect(mutateAsync(useUpdateAnnotationByAnnotationAndAnalysisIds as Mock)).toHaveBeenCalledWith([
            expect.objectContaining({
                analysis: 'cloned-analysis-1',
                study: clonedStudyId,
                note: { included: true },
            }),
        ]);
        expect(mockReplaceStudyWithNewClonedStudy).toHaveBeenCalledWith(sourceStudyId, clonedStudyId);
        expect(updateExtractionTableStateStudySwapInStorage).toHaveBeenCalledWith(
            projectId,
            sourceStudyId,
            clonedStudyId
        );
    });

    it('returns undefined when studyId is missing', async () => {
        (useParams as Mock).mockReturnValue({ projectId, studyId: undefined });
        const { result } = renderHook(() => useCloneStudy());

        let returnedStudy: StudyRequest | undefined;
        await act(async () => {
            returnedStudy = await result.current.cloneStudy({});
        });

        expect(returnedStudy).toBeUndefined();
        expect(mutateAsync(useCreateStudy as Mock)).not.toHaveBeenCalled();
    });

    it('throws when the source study is not in the studyset', async () => {
        (useGetStudysetNonNestedById as Mock).mockReturnValue({
            isLoading: false,
            data: {
                studies: ['missing-study'],
                studyset_studies: [{ id: 'missing-study' }],
            },
        });

        const { result } = renderHook(() => useCloneStudy());

        await expect(
            act(async () => {
                await result.current.cloneStudy({});
            })
        ).rejects.toThrow('study not found in studyset');
    });

    it('skips annotation updates when annotationId is missing', async () => {
        (useProjectExtractionAnnotationId as Mock).mockReturnValue(undefined);
        const { result } = renderHook(() => useCloneStudy());

        await act(async () => {
            await result.current.cloneStudy({});
        });

        expect(mutateAsync(useUpdateAnnotationByAnnotationAndAnalysisIds as Mock)).not.toHaveBeenCalled();
    });
});

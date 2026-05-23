import { act, renderHook } from '@testing-library/react-hooks';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import analysisQueries from 'hooks/analyses/analysisQueries';
import annotationQueries from 'hooks/annotations/annotationQueries';
import {
    useCreateAnalysis,
    useDeleteAnalysis,
    useUpdateAnalysis,
    useUpdateAnnotationByAnnotationAndAnalysisIds,
    useUpdateAnnotationById,
    useUpdateImage,
} from 'hooks';
import { useQueryClient } from 'react-query';
import { vi, Mock } from 'vitest';
import useIbmaBoardMutations from './useIbmaBoardMutations';
import useEnsureWritableStudy from './useEnsureWritableStudy';

vi.mock('react-query');
vi.mock('hooks');
vi.mock('./useEnsureWritableStudy');

const studyId = 'study-1';
const annotationId = 'annotation-1';

const hookArgs = {
    studyId,
    annotationId,
    annotation: {
        id: annotationId,
        note_keys: {
            included: { type: 'boolean', order: 0 },
        },
        notes: [
            {
                analysis: 'analysis-1',
                study: studyId,
                note: { included: false },
            },
        ],
    },
};

const mutateAsync = (hook: Mock) => hook.mock.results[0].value.mutateAsync as Mock;

const mockEnsureWritableStudy = vi.fn().mockResolvedValue({
    studyId,
    didClone: false,
    idMap: {
        oldAnalysisIdsToNewIdsMap: { 'analysis-1': 'analysis-1' },
        oldImageIdToNewIdMap: { 'img-1': 'img-1', 'img-2': 'img-2' },
    },
});

describe('useIbmaBoardMutations', () => {
    beforeEach(() => {
        mockEnsureWritableStudy.mockClear();
        (useEnsureWritableStudy as Mock).mockReturnValue({
            ensureWritableStudy: mockEnsureWritableStudy,
            isLoading: false,
            userOwnsStudy: true,
        });
    });

    const invalidateQueries = () => (useQueryClient as Mock)().invalidateQueries as Mock;

    it('createAnalysis posts analysis and refetches board queries', async () => {
        /**
         * Is is the backend's responsibility to create the annotation notes when an analysis is created.
         */
        const { result } = renderHook(() => useIbmaBoardMutations(hookArgs));

        await act(async () => {
            await result.current.createAnalysis();
        });

        expect(mutateAsync(useCreateAnalysis as Mock)).toHaveBeenCalledWith({
            study: studyId,
            name: '',
            description: '',
        });
        expect(mutateAsync(useUpdateAnnotationById as Mock)).not.toHaveBeenCalled();
        expect(invalidateQueries()).toHaveBeenCalledWith(analysisQueries.analyses.byStudyId(studyId).queryKey);
        expect(invalidateQueries()).toHaveBeenCalledWith(annotationQueries.byId(annotationId).queryKey);
    });

    it('updateAnalysis puts analysis fields', async () => {
        const { result } = renderHook(() => useIbmaBoardMutations(hookArgs));

        await act(async () => {
            await result.current.updateAnalysis({
                analysisId: 'analysis-1',
                name: 'Updated',
                description: 'Desc',
            });
        });

        expect(mutateAsync(useUpdateAnalysis as Mock)).toHaveBeenCalledWith({
            analysisId: 'analysis-1',
            analysis: { name: 'Updated', description: 'Desc' },
        });
    });

    it('deleteAnalysis deletes analysis only', async () => {
        /**
         * It is the backend's responsibility to delete the annotation notes when an analysis is deleted.
         */
        const { result } = renderHook(() => useIbmaBoardMutations(hookArgs));

        await act(async () => {
            await result.current.deleteAnalysis('analysis-1');
        });

        expect(mutateAsync(useDeleteAnalysis as Mock)).toHaveBeenCalledWith('analysis-1');
        expect(mutateAsync(useUpdateAnnotationById as Mock)).not.toHaveBeenCalled();
    });

    it('addAnnotationColumn puts note_keys and note defaults', async () => {
        const { result } = renderHook(() => useIbmaBoardMutations(hookArgs));

        await act(async () => {
            await result.current.addAnnotationColumn({
                key: 'new_col',
                type: EPropertyType.STRING,
                default: 'x',
            });
        });

        expect(mutateAsync(useUpdateAnnotationById as Mock)).toHaveBeenCalledWith(
            expect.objectContaining({
                annotation: expect.objectContaining({
                    note_keys: expect.objectContaining({
                        new_col: expect.objectContaining({ type: EPropertyType.STRING }),
                    }),
                    notes: [
                        expect.objectContaining({
                            note: expect.objectContaining({ new_col: 'x' }),
                        }),
                    ],
                }),
            })
        );
    });

    it('removeAnnotationColumn removes key from note_keys and notes', async () => {
        const { result } = renderHook(() =>
            useIbmaBoardMutations({
                ...hookArgs,
                annotation: {
                    ...hookArgs.annotation,
                    note_keys: {
                        included: { type: 'boolean', order: 0 },
                        custom_field: { type: 'string', order: 1 },
                    },
                    notes: [
                        {
                            analysis: 'analysis-1',
                            study: studyId,
                            note: { included: false, custom_field: 'value' },
                        },
                    ],
                },
            })
        );

        await act(async () => {
            await result.current.removeAnnotationColumn('custom_field');
        });

        expect(mutateAsync(useUpdateAnnotationById as Mock)).toHaveBeenCalledWith(
            expect.objectContaining({
                annotation: expect.objectContaining({
                    note_keys: expect.not.objectContaining({ custom_field: expect.anything() }),
                    notes: [expect.objectContaining({ note: { included: false } })],
                }),
            })
        );
    });

    it('updateAnnotationCell posts annotation-analyses when note exists', async () => {
        const { result } = renderHook(() => useIbmaBoardMutations(hookArgs));

        await act(async () => {
            await result.current.updateAnnotationCell({
                analysisId: 'analysis-1',
                columnKey: 'included',
                value: true,
            });
        });

        expect(mutateAsync(useUpdateAnnotationByAnnotationAndAnalysisIds as Mock)).toHaveBeenCalledWith([
            {
                id: `${annotationId}_analysis-1`,
                note: { included: true },
            },
        ]);
    });

    it('updateImage assigns image to analysis and invalidates board', async () => {
        const { result } = renderHook(() => useIbmaBoardMutations(hookArgs));

        await act(async () => {
            await result.current.updateImage('img-2', { analysis: 'analysis-1' });
        });

        expect(mutateAsync(useUpdateImage as Mock)).toHaveBeenCalledWith({
            imageId: 'img-2',
            image: { id: 'img-2', analysis: 'analysis-1' },
        });
        expect(invalidateQueries()).toHaveBeenCalled();
    });

    it('updateImage clears image.analysis and invalidates board', async () => {
        const { result } = renderHook(() => useIbmaBoardMutations(hookArgs));

        await act(async () => {
            await result.current.updateImage('img-1', { analysis: undefined });
        });

        expect(mutateAsync(useUpdateImage as Mock)).toHaveBeenCalledWith({
            imageId: 'img-1',
            image: { id: 'img-1', analysis: undefined },
        });
        expect(invalidateQueries()).toHaveBeenCalled();
    });
});

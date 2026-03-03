import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import { useAnnotationStore } from './AnnotationStore';

const mocks = vi.hoisted(() => ({
    annotationAnalysesPost: vi.fn(),
    annotationsIdPut: vi.fn(),
    setUnloadHandler: vi.fn(),
}));

vi.mock('api/api.config', () => ({
    default: {
        NeurostoreServices: {
            AnalysesService: {
                annotationAnalysesPost: mocks.annotationAnalysesPost,
            },
            AnnotationsService: {
                annotationsIdPut: mocks.annotationsIdPut,
            },
        },
    },
}));

vi.mock('helpers/BeforeUnload.helpers', () => ({
    setUnloadHandler: mocks.setUnloadHandler,
}));

describe('AnnotationStore updateAnnotationInDB', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useAnnotationStore.setState((state) => ({
            ...state,
            annotation: {
                ...state.annotation,
                notes: [],
                note_keys: [],
                id: undefined,
            },
            storeMetadata: {
                ...state.storeMetadata,
                annotationIsEdited: false,
                noteKeysHaveChanged: false,
                updateAnnotationIsLoading: false,
                isError: false,
            },
        }));
    });

    it('uses the full annotation update when local notes have not been materialized yet', async () => {
        mocks.annotationsIdPut.mockResolvedValue({ data: {} });

        useAnnotationStore.setState((state) => ({
            ...state,
            annotation: {
                ...state.annotation,
                id: 'annotation-id',
                note_keys: [{ key: 'included', type: EPropertyType.BOOLEAN, order: 0, default: true }],
                notes: [
                    {
                        analysis: 'analysis-id',
                        study: 'study-id',
                        annotation: 'annotation-id',
                        note: { included: true },
                        isNew: true,
                    },
                ],
            },
        }));

        await useAnnotationStore.getState().updateAnnotationInDB();

        expect(mocks.annotationsIdPut).toHaveBeenCalledWith('annotation-id', {
            notes: [
                {
                    analysis: 'analysis-id',
                    study: 'study-id',
                    note: { included: true },
                },
            ],
        });
        expect(mocks.annotationAnalysesPost).not.toHaveBeenCalled();
    });

    it('keeps split updates for persisted rows when only note keys and existing notes changed', async () => {
        mocks.annotationsIdPut.mockResolvedValue({ data: {} });
        mocks.annotationAnalysesPost.mockResolvedValue({ data: [] });

        useAnnotationStore.setState((state) => ({
            ...state,
            annotation: {
                ...state.annotation,
                id: 'annotation-id',
                note_keys: [{ key: 'included', type: EPropertyType.BOOLEAN, order: 0, default: true }],
                notes: [
                    {
                        analysis: 'analysis-id',
                        study: 'study-id',
                        annotation: 'annotation-id',
                        note: { included: false },
                        isEdited: true,
                    },
                ],
            },
            storeMetadata: {
                ...state.storeMetadata,
                noteKeysHaveChanged: true,
            },
        }));

        await useAnnotationStore.getState().updateAnnotationInDB();

        expect(mocks.annotationsIdPut).toHaveBeenCalledWith('annotation-id', {
            note_keys: {
                included: {
                    default: true,
                    order: 0,
                    type: 'boolean',
                },
            },
        });
        expect(mocks.annotationAnalysesPost).toHaveBeenCalledWith([
            {
                id: 'annotation-id_analysis-id',
                note: { included: false },
            },
        ]);
    });
});

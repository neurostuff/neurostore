import { AxiosResponse } from 'axios';
import { getType, IMetadataRowModel } from 'components/EditMetadata';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';
import API, { NeurostoreAnnotation } from 'utils/api';
import { create } from 'zustand';
import {
    annotationNotesToHotData,
    AnnotationNoteValue,
    noteKeyObjToArr,
    NoteKeyType,
} from './helpers/utils';

type AnnotationStoreActions = {
    initStore: (annotationId: string) => void;
    updateAnnotationInDB: () => void;
    updateAnnotationIsEdited: (isEdited: boolean) => void;
    addHotColumn: (col: IMetadataRowModel) => boolean;
    removeHotColumn: (key: String) => void;
};

type AnnotationStoreMetadata = {
    annotationIsEdited: boolean;
    annotationIsLoading: boolean;
    isError: boolean;
};

type HotMetadata = {
    hotData: AnnotationNoteValue[][];
    hotDataToStudyMapping: Map<number, { studyId: string; analysisId: string }>;
};

interface IStoreNeurostoreAnnotation extends Omit<NeurostoreAnnotation, 'note_keys'> {
    note_keys: NoteKeyType[];
}

const useAnnotationStore = create<
    {
        annotation: IStoreNeurostoreAnnotation;
        hotMetadata: HotMetadata;
        storeMetadata: AnnotationStoreMetadata;
    } & AnnotationStoreActions
>()((set) => ({
    annotation: {
        id: undefined,
        name: '',
        description: '',
        studyset: undefined,
        note_keys: [],
        metadata: null,
        notes: [],
        source: undefined,
        source_id: undefined,
        created_at: undefined,
        updated_at: undefined,
        source_updated_at: undefined,
        user: undefined,
    },
    hotMetadata: {
        hotData: [],
        hotDataToStudyMapping: new Map<number, { studyId: string; analysisId: string }>(),
    },
    storeMetadata: {
        annotationIsEdited: false,
        annotationIsLoading: false,
        isError: false,
    },
    initStore: async (annotationId) => {
        if (!annotationId) return;
        set((state) => ({
            ...state,
            isLoading: true,
        }));
        try {
            const annotationRes = (await API.NeurostoreServices.AnnotationsService.annotationsIdGet(
                annotationId
            )) as AxiosResponse<NeurostoreAnnotation>;

            // convert notes to hot data
            // create mapping between hot data indices and study/analyses
            const noteKeys = noteKeyObjToArr(annotationRes.data?.note_keys);
            const { hotData, hotDataToStudyMapping } = annotationNotesToHotData(
                noteKeys,
                annotationRes.data.notes as NoteCollectionReturn[] | undefined
            );

            set((state) => ({
                ...state,
                annotation: {
                    ...state.annotation,
                    ...annotationRes.data,
                    note_keys: noteKeys,
                },
                hotMetadata: {
                    hotData: hotData,
                    hotDataToStudyMapping: hotDataToStudyMapping,
                },
                storeMetadata: {
                    ...state.storeMetadata,
                    annotationIsEdited: false,
                    annotationIsLoading: false,
                },
            }));
        } catch (e) {
            set((state) => ({
                ...state,
                storeMetadata: {
                    ...state.storeMetadata,
                    annotationIsLoading: false,
                    isError: true,
                },
            }));
        }
    },
    updateAnnotationInDB: async () => {
        try {
            const state = useAnnotationStore.getState();
            if (!state.annotation.id) throw new Error('no annotation id');
            set((state) => ({
                ...state,
                storeMetadata: {
                    ...state.storeMetadata,
                    annotationIsLoading: true,
                },
            }));

            // TODO: some sort of conversion between HOTDATA and note keys

            await API.NeurostoreServices.AnnotationsService.annotationsIdPut(state.annotation.id, {
                name: state.annotation.name,
                description: state.annotation.description,
            });
            set((state) => ({
                ...state,
                storeMetadata: {
                    ...state.storeMetadata,
                    annotationIsEdited: false,
                    annotationIsLoading: false,
                },
            }));
        } catch (e) {
            set((state) => ({
                ...state,
                storeMetadata: {
                    ...state.storeMetadata,
                    annotationIsLoading: false,
                    isError: true,
                },
            }));
            throw new Error('error updating study');
        }
    },
    updateAnnotationIsEdited: (isEdited) => {
        set((state) => ({
            ...state,
            storeMetadata: {
                ...state.storeMetadata,
                annotationIsEdited: isEdited,
            },
        }));
    },
    addHotColumn: (col) => {
        const state = useAnnotationStore.getState();
        if (state.annotation.note_keys.find((x) => x.key === col.metadataKey)) return false;

        set((state) => {
            const updatedNoteKeys = [
                { key: col.metadataKey, type: getType(col.metadataValue) },
                ...state.annotation.note_keys,
            ];

            const updatedHotData = [...state.hotMetadata.hotData];
            updatedHotData.forEach((row, index) => {
                const updatedRow = [...row];
                updatedRow.splice(2, 0, null);
                updatedHotData[index] = updatedRow;
            });

            return {
                ...state,
                annotation: {
                    ...state.annotation,
                    note_keys: updatedNoteKeys,
                },
                hotMetadata: {
                    ...state.hotMetadata,
                    hotData: updatedHotData,
                },
            };
        });
        return true;
    },
    removeHotColumn: (key) => {
        set((state) => {
            const updatedNoteKeys = [...state.annotation.note_keys];
            const foundNoteKeyIndex = updatedNoteKeys.findIndex((x) => x.key === key);

            if (foundNoteKeyIndex < 0) return state;

            updatedNoteKeys.splice(foundNoteKeyIndex, 1);
            const updatedHotData = [...state.hotMetadata.hotData];
            updatedHotData.forEach((row) => {
                const updatedRow = [...row];
                updatedRow.splice(foundNoteKeyIndex + 2, 1); // add 2 as study and analysis id are the first 2 cols
            });

            return {
                ...state,
                annotation: {
                    ...state.annotation,
                    note_keys: updatedNoteKeys,
                },
                hotMetadata: {
                    ...state.hotMetadata,
                    hotData: updatedHotData,
                },
            };
        });
    },
}));

export const useAnnotationIsLoading = () =>
    useAnnotationStore((state) => state.storeMetadata.annotationIsLoading);
export const useAnnotationHasBeenEdited = () =>
    useAnnotationStore((state) => state.storeMetadata.annotationIsEdited);
export const useHotData = () => useAnnotationStore((state) => state.hotMetadata.hotData);
export const useHotMapping = () =>
    useAnnotationStore((state) => state.hotMetadata.hotDataToStudyMapping);
export const useAnnotationNoteKeys = () =>
    useAnnotationStore((state) => state.annotation.note_keys);

export const useUpdateAnnotationInDB = () =>
    useAnnotationStore((state) => state.updateAnnotationInDB);
export const useInitAnnotationStore = () => useAnnotationStore((state) => state.initStore);
export const useUpdateAnnotationIsEdited = () =>
    useAnnotationStore((state) => state.updateAnnotationIsEdited);
export const useUpdateAnnotationRemoveColumn = () =>
    useAnnotationStore((state) => state.removeHotColumn);
export const useUpdateAnnotationAddColumn = () => useAnnotationStore((state) => state.addHotColumn);

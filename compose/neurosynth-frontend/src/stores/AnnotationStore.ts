import { AnnotationReturnOneOf1, NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { noteKeyObjToArr } from 'stores/AnnotationStore.helpers';
import API from 'utils/api';
import { create } from 'zustand';
import {
    AnnotationStoreActions,
    AnnotationStoreMetadata,
    IStoreAnnotation,
} from 'stores/AnnotationStore.types';
import { noteKeyArrToObj } from 'components/EditAnnotations/helpers/utils';

export const useAnnotationStore = create<
    {
        annotation: IStoreAnnotation;
        storeMetadata: AnnotationStoreMetadata;
    } & AnnotationStoreActions
>()((set) => {
    return {
        annotation: {
            tabularData: [],
            notes: [],
            note_keys: [],
            created_at: undefined,
            updated_at: undefined,
            description: undefined,
            name: undefined,
            id: undefined,
            metadata: undefined,
            source: undefined,
            source_id: undefined,
            source_updated_at: undefined,
            studyset: undefined,
            user: undefined,
            username: undefined,
        },
        storeMetadata: {
            annotationIsEdited: false,
            annotationIsLoading: false,
            isError: false,
        },

        initAnnotationStore: async (annotationId) => {
            if (!annotationId) return;
            set((state) => ({
                ...state,
                storeMetadata: {
                    ...state.storeMetadata,
                    annotationIsLoading: true,
                },
            }));

            try {
                const annotationRes = (
                    await API.NeurostoreServices.AnnotationsService.annotationsIdGet(annotationId)
                ).data as AnnotationReturnOneOf1;

                const noteKeysArr = noteKeyObjToArr(annotationRes.note_keys);
                const notes = annotationRes.notes as Array<NoteCollectionReturn>;

                set((state) => ({
                    ...state,
                    annotation: {
                        ...state.annotation,
                        ...annotationRes,
                        notes: notes,
                        note_keys: [...noteKeysArr],
                    },
                    storeMetadata: {
                        ...state.storeMetadata,
                        annotationIsEdited: false,
                        annotationIsLoading: false,
                        isError: false,
                    },
                }));
            } catch (e) {
                console.error(e);
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
        setAnnotationIsEdited: (isEdited) => {
            set((state) => ({
                ...state,
                storeMetadata: {
                    ...state.storeMetadata,
                    annotationIsEdited: isEdited,
                },
            }));
        },
        clearAnnotationStore: () => {
            set((state) => ({
                ...state,
                annotation: {
                    tabularData: [],
                    notes: [],
                    note_keys: [],
                    created_at: undefined,
                    updated_at: undefined,
                    description: undefined,
                    name: undefined,
                    id: undefined,
                    metadata: undefined,
                    source: undefined,
                    source_id: undefined,
                    source_updated_at: undefined,
                    studyset: undefined,
                    user: undefined,
                    username: undefined,
                },
                storeMetadata: {
                    annotationIsEdited: false,
                    annotationIsLoading: false,
                    isError: false,
                },
            }));
        },
        updateNotes: (updatedNotes) => {
            set((state) => ({
                ...state,
                annotation: {
                    ...state.annotation,
                    notes: updatedNotes,
                },
            }));
        },
        createAnnotationNote: (analysisName, analysisDescription) => {
            // set((state) => ({
            //     ...state,
            //     annotation: {
            //         ...state.annotation,
            //         notes: [...state.annotation.notes, {
            //             analysis: uuidV4()
            //         }]
            //     }
            // }))
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

                await API.NeurostoreServices.AnnotationsService.annotationsIdPut(
                    state.annotation.id,
                    {
                        notes: state.annotation.notes.map((annotationNote) => ({
                            analysis: annotationNote.analysis,
                            study: annotationNote.study,
                            note: annotationNote.note,
                        })),
                    }
                );

                set((state) => ({
                    ...state,
                    storeMetadata: {
                        ...state.storeMetadata,
                        annotationIsLoading: false,
                        isError: false,
                        annotationIsEdited: false,
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
                console.error(e);
                throw new Error('Could not update annotation in DB');
            }
        },
    };
});

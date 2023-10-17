import {
    AnalysesApi,
    AnnotationReturnOneOf1,
    NoteCollectionReturn,
} from 'neurostore-typescript-sdk';
import {
    noteKeyArrToDefaultNoteKeyObj,
    noteKeyObjToArr,
    updateNotesHelper,
} from 'stores/AnnotationStore.helpers';
import API from 'utils/api';
import { create } from 'zustand';
import {
    AnnotationStoreActions,
    AnnotationStoreMetadata,
    IStoreAnnotation,
    IStoreNoteCollectionReturn,
} from 'stores/AnnotationStore.types';

export const useAnnotationStore = create<
    {
        annotation: IStoreAnnotation;
        storeMetadata: AnnotationStoreMetadata;
    } & AnnotationStoreActions
>()((set) => {
    return {
        annotation: {
            notes: undefined, // for each analysis across all studies, along with the specific values for a given column (i.e. note)
            note_keys: undefined, // all columns
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
                const notes: IStoreNoteCollectionReturn[] = (
                    annotationRes.notes as Array<NoteCollectionReturn>
                )
                    ?.map((x) => ({ ...x, isNew: false }))
                    ?.sort((a, b) =>
                        (a?.analysis_name || '').localeCompare(b?.analysis_name || '')
                    );

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
                    notes: updateNotesHelper(state.annotation.notes, updatedNotes),
                },
                storeMetadata: {
                    ...state.storeMetadata,
                    annotationIsEdited: true,
                },
            }));
        },
        createAnnotationNote: (analysisId, studyId, analysisName) => {
            set((state) => {
                if (!state.annotation.notes || !state.annotation.note_keys) return state;

                return {
                    ...state,
                    annotation: {
                        ...state.annotation,
                        notes: [
                            {
                                study: studyId,
                                study_name: '',
                                study_year: null,
                                publication: '',
                                authors: '',
                                analysis: analysisId,
                                analysis_name: analysisName,
                                annotation: state.annotation.id,
                                note: {
                                    ...noteKeyArrToDefaultNoteKeyObj(state.annotation.note_keys),
                                    included: true,
                                },
                                isNew: true,
                            },
                            ...state.annotation.notes,
                        ],
                    },
                };
            });
        },
        deleteAnnotationNote: (analysisId) => {
            set((state) => ({
                ...state,
                annotation: {
                    ...state.annotation,
                    notes: state.annotation.notes
                        ? state.annotation.notes.filter((x) => x.analysis !== analysisId)
                        : undefined,
                },
            }));
        },
        updateAnnotationInDB: async () => {
            try {
                const state = useAnnotationStore.getState();
                if (!state.annotation.id) throw new Error('no annotation id');
                if (!state.annotation.notes) return;
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

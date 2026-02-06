import API from 'api/api.config';
import { NoteKeyType } from 'components/HotTables/HotTables.types';
import { noteKeyArrToObj } from 'components/HotTables/HotTables.utils';
import { setUnloadHandler } from 'helpers/BeforeUnload.helpers';
import { AnnotationReturnOneOf, NoteCollectionReturn } from 'neurostore-typescript-sdk';
import {
    noteKeyArrToDefaultNoteKeyObj,
    noteKeyObjToArr,
    storeNotesToDBNotes,
    updateNoteDetailsHelper,
} from 'stores/AnnotationStore.helpers';
import {
    AnnotationStoreActions,
    AnnotationStoreMetadata,
    IStoreAnnotation,
    IStoreNoteCollectionReturn,
} from 'stores/AnnotationStore.types';
import { create } from 'zustand';

const normalizeNoteKeyOrder = (noteKeys: NoteKeyType[]) =>
    noteKeys.map((noteKey, index) => ({ ...noteKey, order: index }));

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
            getAnnotationIsLoading: false,
            updateAnnotationIsLoading: false,
            isError: false,
        },

        initAnnotationStore: async (annotationId) => {
            if (!annotationId) return;
            set((state) => ({
                ...state,
                storeMetadata: {
                    ...state.storeMetadata,
                    getAnnotationIsLoading: true,
                    updateAnnotationIsLoading: true,
                },
            }));

            try {
                const annotationRes = (await API.NeurostoreServices.AnnotationsService.annotationsIdGet(annotationId))
                    .data as AnnotationReturnOneOf;

                const noteKeysArr = noteKeyObjToArr(annotationRes.note_keys);
                const notes: IStoreNoteCollectionReturn[] = (annotationRes.notes as Array<NoteCollectionReturn>)?.map(
                    (x) => ({ ...x, isNew: false, isEdited: false })
                );

                set((state) => ({
                    ...state,
                    annotation: {
                        ...state.annotation,
                        ...annotationRes,
                        notes: notes,
                        note_keys: noteKeysArr,
                    },
                    storeMetadata: {
                        ...state.storeMetadata,
                        annotationIsEdited: false,
                        getAnnotationIsLoading: false,
                        updateAnnotationIsLoading: false,
                        isError: false,
                    },
                }));
            } catch (e) {
                console.error(e);
                set((state) => ({
                    ...state,
                    storeMetadata: {
                        ...state.storeMetadata,
                        getAnnotationIsLoading: false,
                        updateAnnotationIsLoading: false,
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
                    getAnnotationIsLoading: false,
                    updateAnnotationIsLoading: false,
                    isError: false,
                },
            }));
        },
        updateNotes: (updatedNotes) => {
            setUnloadHandler('annotation');
            set((state) => ({
                ...state,
                annotation: {
                    ...state.annotation,
                    notes: [...updatedNotes],
                },
                storeMetadata: {
                    ...state.storeMetadata,
                    annotationIsEdited: true,
                },
            }));
        },
        createAnnotationColumn: (noteKey) => {
            setUnloadHandler('annotation');
            set((state) => ({
                ...state,
                annotation: {
                    ...state.annotation,
                    note_keys: normalizeNoteKeyOrder([
                        { ...noteKey, isNew: true, order: 0 },
                        ...(state.annotation.note_keys ?? []),
                    ]),
                    notes: (state.annotation.notes ?? []).map((note) => ({
                        ...note,
                        note: {
                            ...note.note,
                            [noteKey.key]: null,
                        },
                    })),
                },
                storeMetadata: {
                    ...state.storeMetadata,
                    annotationIsEdited: true,
                },
            }));
        },
        removeAnnotationColumn: (noteKey) => {
            setUnloadHandler('annotation');
            set((state) => {
                if (!state.annotation.note_keys || !state.annotation.notes) return state;
                const updatedNoteKeys = normalizeNoteKeyOrder(
                    state.annotation.note_keys.filter((x) => x.key !== noteKey)
                );
                const updatedNotes = [...state.annotation.notes];
                updatedNotes.forEach((note) => {
                    const typedNote = note.note as Record<string, string | boolean | number | null> | undefined;
                    if (!typedNote) return;
                    delete typedNote[noteKey];
                });

                return {
                    ...state,
                    annotation: {
                        ...state.annotation,
                        note_keys: updatedNoteKeys,
                        notes: updatedNotes,
                    },
                    storeMetadata: {
                        ...state.storeMetadata,
                        annotationIsEdited: true,
                    },
                };
            });
        },
        updateAnnotationNoteDetails: (note) => {
            set((state) => {
                return {
                    ...state,
                    annotation: {
                        ...state.annotation,
                        notes: updateNoteDetailsHelper(state.annotation.notes || [], note),
                    },
                };
            });
        },
        createAnnotationNote: (analysisId, studyId, analysisName) => {
            setUnloadHandler('annotation');
            set((state) => {
                if (!state.annotation.notes || !state.annotation.note_keys) return state;

                return {
                    ...state,
                    annotation: {
                        ...state.annotation,
                        notes: [
                            ...state.annotation.notes,
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
                        ],
                    },
                };
            });
        },
        deleteAnnotationNote: (analysisId) => {
            setUnloadHandler('annotation');
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
                        updateAnnotationIsLoading: true,
                    },
                }));

                const hasNewNoteKey = (state.annotation.note_keys ?? []).some((noteKey) => !!noteKey.isNew);

                if (hasNewNoteKey) {
                    // if there are new note keys, we need to update the annotation using the generic update endpoint
                    await API.NeurostoreServices.AnnotationsService.annotationsIdPut(state.annotation.id, {
                        note_keys: noteKeyArrToObj(state.annotation.note_keys ?? []),
                        notes: storeNotesToDBNotes(state.annotation.notes),
                    });
                } else {
                    // if there are no new note keys, we can use the optimized annotation endpoint
                    await API.NeurostoreServices.AnnotationsService.annotationAnalysesPost(
                        state.annotation.notes
                            .filter((note) => note.isEdited)
                            .map((note) => ({
                                id: `${state.annotation.id}_${note.analysis}`,
                                note: note.note,
                            }))
                    );
                }

                const noteKeysArr = (state.annotation.note_keys ?? []).map((noteKey) => ({ ...noteKey, isNew: false }));
                const notesAfterDBUpdate = state.annotation.notes.map((note) => ({
                    ...note,
                    isEdited: false,
                    isNew: false,
                }));

                set((state) => ({
                    ...state,
                    annotation: {
                        ...state.annotation,
                        notes: notesAfterDBUpdate,
                        note_keys: noteKeysArr,
                    },
                    storeMetadata: {
                        ...state.storeMetadata,
                        annotationIsEdited: false,
                        updateAnnotationIsLoading: false,
                        isError: false,
                    },
                }));
            } catch (e) {
                set((state) => ({
                    ...state,
                    storeMetadata: {
                        ...state.storeMetadata,
                        updateAnnotationIsLoading: false,
                        isError: true,
                    },
                }));
                console.error(e);
                throw new Error('Could not update annotation in DB');
            }
        },
    };
});

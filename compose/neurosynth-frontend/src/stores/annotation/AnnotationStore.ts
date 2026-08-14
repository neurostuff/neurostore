import { NoteKeyType } from 'components/HotTables/HotTables.types';
import { getDefaultForNoteKey, noteKeyArrToObj, noteKeyObjToArr } from 'components/HotTables/HotTables.utils';
import { setUnloadHandler } from 'helpers/BeforeUnload.helpers';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';
import {
    noteKeyArrToDefaultNoteKeyObj,
    storeNotesToDBNotes,
    updateNoteDetailsHelper,
} from 'stores/annotation/AnnotationStore.helpers';
import {
    AnnotationStoreActions,
    AnnotationStoreMetadata,
    IStoreAnnotation,
    IStoreNoteCollectionReturn,
} from 'stores/annotation/AnnotationStore.types';
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
            noteKeysHaveChanged: false,
            getAnnotationIsLoading: false,
            updateAnnotationIsLoading: false,
            isError: false,
            updateAnnotations: undefined,
            updateAnnotationAnalyses: undefined,
        },

        initAnnotationStore: (annotation) => {
            if (!annotation) return;

            const noteKeysArr = noteKeyObjToArr(annotation.note_keys);
            const notes: IStoreNoteCollectionReturn[] = (annotation.notes as Array<NoteCollectionReturn>)?.map((x) => ({
                ...x,
                isNew: false,
                isEdited: false,
            }));

            set((state) => ({
                ...state,
                annotation: {
                    ...state.annotation,
                    ...annotation,
                    notes,
                    note_keys: noteKeysArr,
                },
                storeMetadata: {
                    ...state.storeMetadata,
                    annotationIsEdited: false,
                    noteKeysHaveChanged: false,
                    isError: false,
                },
            }));
        },
        updateAnnotationMetadata: (metadataUpdate) => {
            set((state) => ({
                ...state,
                storeMetadata: {
                    ...state.storeMetadata,
                    ...metadataUpdate,
                },
            }));
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
                    noteKeysHaveChanged: false,
                    isError: false,
                    updateAnnotations: undefined,
                    updateAnnotationAnalyses: undefined,
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
            const resolvedDefault = noteKey.default ?? getDefaultForNoteKey(noteKey.key, noteKey.type);
            set((state) => ({
                ...state,
                annotation: {
                    ...state.annotation,
                    note_keys: normalizeNoteKeyOrder([
                        {
                            ...noteKey,
                            default: resolvedDefault,
                            order: 0,
                        },
                        ...(state.annotation.note_keys ?? []),
                    ]),
                    notes: (state.annotation.notes ?? []).map((note) => ({
                        ...note,
                        note: {
                            ...note.note,
                            [noteKey.key]: resolvedDefault,
                        },
                    })),
                },
                storeMetadata: {
                    ...state.storeMetadata,
                    noteKeysHaveChanged: true,
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
                        noteKeysHaveChanged: true,
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
            const state = useAnnotationStore.getState();
            if (!state.annotation.id) throw new Error('no annotation id');
            if (!state.annotation.notes) return;

            const updateAnnotations = state.storeMetadata.updateAnnotations;
            const updateAnnotationAnalyses = state.storeMetadata.updateAnnotationAnalyses;

            try {
                if (state.storeMetadata.noteKeysHaveChanged) {
                    if (!updateAnnotations) {
                        throw new Error('updateAnnotations is not configured on the annotation store');
                    }
                    await updateAnnotations({
                        argAnnotationId: state.annotation.id,
                        annotation: {
                            note_keys: noteKeyArrToObj(state.annotation.note_keys ?? []),
                            notes: storeNotesToDBNotes(state.annotation.notes),
                        },
                    });
                } else {
                    if (!updateAnnotationAnalyses) {
                        throw new Error('updateAnnotationAnalyses is not configured on the annotation store');
                    }
                    await updateAnnotationAnalyses(
                        state.annotation.notes
                            .filter((note) => note.isEdited)
                            .map((note) => ({
                                id: `${state.annotation.id}_${note.analysis}`,
                                note: note.note,
                            }))
                    );
                }

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
                    },
                    storeMetadata: {
                        ...state.storeMetadata,
                        annotationIsEdited: false,
                        noteKeysHaveChanged: false,
                        isError: false,
                    },
                }));
            } catch (e) {
                console.error(e);
                throw new Error('Could not update annotation in DB');
            }
        },
    };
});

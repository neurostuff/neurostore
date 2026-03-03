import { NoteKeyType } from 'components/HotTables/HotTables.types';
import { noteKeyArrToObj } from 'components/HotTables/HotTables.utils';
import { AnnotationNoteType, IStoreNoteCollectionReturn } from 'stores/AnnotationStore.types';
import { AnnotationRequestOneOf, NoteCollectionRequest } from 'neurostore-typescript-sdk';

type NoteCollectionLike = Pick<NoteCollectionRequest, 'analysis' | 'study' | 'note'>;

export type AnnotationSaveNote = NoteCollectionLike & {
    isEdited?: boolean;
    isNew?: boolean;
};

export type AnnotationNoteUpdateRequest = {
    id: string;
    note: NoteCollectionRequest['note'];
};

export const noteKeyArrToDefaultNoteKeyObj = (noteKeys: NoteKeyType[]): AnnotationNoteType => {
    const x = noteKeys.reduce((acc, curr) => {
        acc[curr.key] = curr.default ?? null;
        return acc;
    }, {} as AnnotationNoteType);
    return x;
};

export const storeNotesToDBNotes = (notes: NoteCollectionLike[]): NoteCollectionRequest[] => {
    return notes.map((annotationNote) => ({
        analysis: annotationNote.analysis,
        study: annotationNote.study,
        note: annotationNote.note,
    }));
};

export const buildEditedAnnotationNoteUpdates = (
    annotationId: string,
    notes: AnnotationSaveNote[]
): AnnotationNoteUpdateRequest[] => {
    return notes
        .filter((note) => note.isEdited && !note.isNew)
        .map((note) => ({
            id: `${annotationId}_${note.analysis}`,
            note: note.note,
        }));
};

export const buildAnnotationSavePlan = (args: {
    annotationId: string;
    noteKeys: NoteKeyType[];
    noteKeysHaveChanged: boolean;
    notes: AnnotationSaveNote[];
}): {
    annotationUpdate?: AnnotationRequestOneOf;
    noteUpdates: AnnotationNoteUpdateRequest[];
    hasChanges: boolean;
} => {
    const hasNewNoteKey = args.noteKeys.some((noteKey) => !!noteKey.isNew);
    const hasNewNotes = args.notes.some((note) => note.isNew);

    if (hasNewNotes) {
        const annotationUpdate: AnnotationRequestOneOf = {
            notes: storeNotesToDBNotes(args.notes),
        };
        if (hasNewNoteKey || args.noteKeysHaveChanged) {
            annotationUpdate.note_keys = noteKeyArrToObj(args.noteKeys);
        }
        return {
            annotationUpdate,
            noteUpdates: [],
            hasChanges: true,
        };
    }

    const annotationUpdate =
        hasNewNoteKey || args.noteKeysHaveChanged
            ? {
                  note_keys: noteKeyArrToObj(args.noteKeys),
              }
            : undefined;
    const noteUpdates = buildEditedAnnotationNoteUpdates(args.annotationId, args.notes);

    return {
        annotationUpdate,
        noteUpdates,
        hasChanges: !!annotationUpdate || noteUpdates.length > 0,
    };
};

export const updateNoteDetailsHelper = (
    notes: IStoreNoteCollectionReturn[],
    update: Partial<IStoreNoteCollectionReturn>
): IStoreNoteCollectionReturn[] => {
    const updatedNotes = [...notes];
    const foundNoteIndex = updatedNotes.findIndex((note) => note.analysis === update.analysis);
    if (foundNoteIndex < 0) return updatedNotes;

    updatedNotes[foundNoteIndex] = {
        ...updatedNotes[foundNoteIndex],
        ...update,
    };
    return updatedNotes;
};

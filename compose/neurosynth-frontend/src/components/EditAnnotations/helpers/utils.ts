import { EPropertyType } from 'components/EditMetadata';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';

export interface NoteKeyType {
    key: string;
    type: EPropertyType;
}

export type AnnotationNoteValue = string | number | boolean | null;

export const noteKeyObjToArr = (noteKeys?: object | null): NoteKeyType[] => {
    if (!noteKeys) return [];
    const noteKeyTypes = noteKeys as { [key: string]: EPropertyType };
    const arr = Object.entries(noteKeyTypes).map(([key, type]) => ({
        key,
        type,
    }));
    return arr;
};

export const noteKeyArrToObj = (noteKeyArr: NoteKeyType[]): { [key: string]: EPropertyType } => {
    const noteKeyObj: { [key: string]: EPropertyType } = noteKeyArr.reduce((acc, curr) => {
        acc[curr.key] = curr.type;
        return acc;
    }, {} as { [key: string]: EPropertyType });

    return noteKeyObj;
};

export const annotationNotesToHotData = (
    noteKeys: NoteKeyType[],
    annotationNotes: NoteCollectionReturn[] | undefined
): {
    hotData: AnnotationNoteValue[][];
    hotDataToStudyMapping: Map<number, { studyId: string; analysisId: string }>;
} => {
    const hotData = new Array<AnnotationNoteValue[]>();
    const hotDataToAnnotationMapping = new Map<number, { studyId: string; analysisId: string }>();

    if (!annotationNotes) {
        return {
            hotData,
            hotDataToStudyMapping: hotDataToAnnotationMapping,
        };
    }

    annotationNotes
        .sort((a, b) => {
            const firstStudyId = a.study as string;
            const secondStudyId = b.study as string;
            return firstStudyId.localeCompare(secondStudyId);
        })
        .forEach((annotationNote, index) => {
            const row = new Array<AnnotationNoteValue>();

            // name should either be: (year) name, name, or empty string
            const studyName =
                annotationNote.study_name && annotationNote.study_year
                    ? `(${annotationNote.study_year}) ${annotationNote.study_name}`
                    : annotationNote.study_name
                    ? annotationNote.study_name
                    : '';
            row.push(studyName);
            row.push(annotationNote.analysis_name || '');

            const valuesObj = annotationNote.note as {
                [key: string]: AnnotationNoteValue;
            };

            noteKeys.forEach((noteKey) => {
                row.push(valuesObj[noteKey.key]);
            });

            hotDataToAnnotationMapping.set(index, {
                studyId: annotationNote.study as string,
                analysisId: annotationNote.analysis as string,
            });
            hotData.push(row);
        });

    return {
        hotData,
        hotDataToStudyMapping: hotDataToAnnotationMapping,
    };
};

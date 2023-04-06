import { EPropertyType } from 'components/EditMetadata';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { DetailedSettings as MergeCellsSettings } from 'handsontable/plugins/mergeCells';

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

export const getMergeCells = (
    hotDataToStudyMapping: Map<number, { studyId: string; analysisId: string }>
) => {
    const mergeCells: MergeCellsSettings[] = [];

    let studyId: string;
    let mergeCellObj: MergeCellsSettings = {
        row: 0,
        col: 0,
        rowspan: 1,
        colspan: 1,
    };
    hotDataToStudyMapping.forEach((value, key) => {
        if (value.studyId === studyId) {
            mergeCellObj.rowspan++;
            if (key === hotDataToStudyMapping.size - 1 && mergeCellObj.rowspan > 1) {
                mergeCells.push(mergeCellObj);
            }
        } else {
            if (mergeCellObj.rowspan > 1) mergeCells.push(mergeCellObj);
            studyId = value.studyId;
            mergeCellObj = {
                row: key,
                col: 0,
                rowspan: 1,
                colspan: 1,
            };
        }
    });

    return mergeCells;
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

    // this is the same obj stored in the react-query hook so we must copy it or else it will cause infinite re renders
    // since we're changing the original references by sorting it
    [...annotationNotes]
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

export const hotDataToAnnotationNotes = (
    hotData: AnnotationNoteValue[][],
    mapping: Map<number, { studyId: string; analysisId: string }>,
    noteKeys: NoteKeyType[]
): NoteCollectionReturn[] => {
    const noteCollections: NoteCollectionReturn[] = hotData.map((row, index) => {
        const mappedStudyAnalysis = mapping.get(index) as { studyId: string; analysisId: string };

        const updatedNote: { [key: string]: AnnotationNoteValue } = {};
        for (let i = 0; i < noteKeys.length; i++) {
            const noteKey = noteKeys[i];
            updatedNote[noteKey.key] = row[i + 2]; // take into account the first two columns which are readonly reseved to display study name and analysis name
        }

        return {
            study: mappedStudyAnalysis.studyId,
            analysis: mappedStudyAnalysis.analysisId,
            note: updatedNote,
        };
    });

    return noteCollections;
};

import { EPropertyType } from 'components/EditMetadata';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { DetailedSettings as MergeCellsSettings } from 'handsontable/plugins/mergeCells';
import { ColumnSettings } from 'handsontable/settings';
import { numericValidator } from 'handsontable/validators';
import styles from '../AnnotationsHotTable/AnnotationsHotTable.module.css';
import { CellValue } from 'handsontable/common';
import { renderToString } from 'react-dom/server';
import Cancel from '@mui/icons-material/Cancel';

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
    annotationNotes: NoteCollectionReturn[] | undefined,
    getColNamesFromAnnotationNote: (note: NoteCollectionReturn) => [string, string]
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
            const [firstColName, secondColName] = getColNamesFromAnnotationNote(annotationNote);
            row.push(firstColName);
            row.push(secondColName);

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

const booleanValidator = (value: CellValue, callback: (isValid: boolean) => void) => {
    const isValid =
        value === true ||
        value === false ||
        value === 'true' ||
        value === 'false' ||
        value === null ||
        value === '';
    callback(isValid);
};

export const createColumns = (noteKeys: NoteKeyType[]) => [
    {
        className: `${styles['study-col']} ${styles['read-only-col']}`,
        readOnly: true,
        width: '200',
    },
    {
        className: styles['read-only-col'],
        readOnly: true,
        width: '150',
    },
    ...noteKeys.map((x) => {
        return {
            readOnly: false,
            className: styles[x.type],
            allowInvalid: false,
            type: x.type === EPropertyType.BOOLEAN ? 'checkbox' : 'text',
            validator:
                x.type === EPropertyType.NUMBER
                    ? numericValidator
                    : x.type === EPropertyType.BOOLEAN
                    ? booleanValidator
                    : undefined,
        } as ColumnSettings;
    }),
];

export const createColumnHeader = (
    colKey: string,
    colType: EPropertyType,
    updateFunc?: (key: string) => void
) => {
    const allowRemove = updateFunc
        ? `<div style="width: 50px;">${renderToString(
              <Cancel
                  onClick={() => updateFunc(colKey)}
                  sx={{ ':hover': { color: 'error.light', cursor: 'pointer' } }}
                  color="error"
              />
          )}</div>`
        : '<div></div>';

    return (
        `<div style="display: flex; align-items: center; justify-content: center; min-width: 160px">` +
        `<div class=${styles[colType]}>${colKey}</div>` +
        allowRemove +
        `</div>`
    );
};

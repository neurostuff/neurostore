import { HotTableProps } from '@handsontable/react';
import { EPropertyType } from 'components/EditMetadata';
import { AnnotationNoteValue, NoteKeyType } from 'components/HotTables/HotTables.types';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { renderToString } from 'react-dom/server';
import Cancel from '@mui/icons-material/Cancel';
import { DetailedSettings as MergeCellsSettings } from 'handsontable/plugins/mergeCells';
import styles from 'components/HotTables/HotTables.module.css';
import { numericValidator } from 'handsontable/validators';
import { booleanValidator } from 'components/HotTables/HotTables.utils';
import { ColumnSettings } from 'handsontable/settings';

export const hotSettings: HotTableProps = {
    licenseKey: 'non-commercial-and-evaluation',
    contextMenu: false,
    viewportRowRenderingOffset: 4,
    viewportColumnRenderingOffset: 4, // we do not want column virtualization as it screws up the spreadsheet
    width: '100%',
    fixedColumnsStart: 2,
    wordWrap: true,
    autoRowSize: true,
    afterGetRowHeaderRenderers: (headerRenderers) => {
        headerRenderers.push((row, TH) => {
            TH.className = styles['no-top-bottom-borders'];
        });
    },
    id: 'hot-annotations',
    fillHandle: {
        direction: 'vertical',
        autoInsertRow: false,
    },
};

export const convertRemToPx = (rem: number) => {
    return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
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

            if (a.study === b.study) {
                return (a.analysis_name || '').localeCompare(b.analysis_name || '');
            }

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

export const createColumnHeader = (
    colKey: string,
    colType: EPropertyType,
    allowRemoveColumn: boolean
) => {
    const allowRemove = allowRemoveColumn
        ? `<div style="width: 50px; display: flex; align-items: center; justify-content: center">
        ${renderToString(
            <Cancel
                sx={{
                    width: '18px',
                    height: '18px',
                    ':hover': { color: 'error.light', cursor: 'pointer' },
                }}
                color="error"
            />
        )}
          </div>`
        : '<div></div>';

    return (
        `<div title="${colKey}" style="display: flex; align-items: center; justify-content: center;">` +
        `<div class="${styles[colType]} ${styles.truncate}" style="width: 150px">${colKey}</div>` +
        allowRemove +
        `</div>`
    );
};

export const createColumns = (noteKeys: NoteKeyType[]) =>
    [
        {
            className: `${styles['study-col']} ${styles['read-only-col']} truncate`,
            readOnly: true,
        },
        {
            className: styles['read-only-col'],
            readOnly: true,
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
    ] as ColumnSettings[];

// we can assume that the input is already sorted
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

import { HotTableProps } from '@handsontable/react-wrapper';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import { AnnotationNoteValue, NoteKeyType } from 'components/HotTables/HotTables.types';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { renderToString } from 'react-dom/server';
import { RemoveCircle } from '@mui/icons-material';
import styles from 'components/HotTables/HotTables.module.css';
import { numericValidator } from 'handsontable/validators';
import { booleanValidator, createColWidths } from 'components/HotTables/HotTables.utils';
import Handsontable from 'handsontable';
import { ColumnSettings } from 'handsontable/settings';

/** Cell merge range shape accepted by Handsontable's mergeCells option. */
export type MergeCellRange = {
    row: number;
    col: number;
    rowspan: number;
    colspan: number;
};

export const hotSettings: HotTableProps = {
    theme: 'ht-theme-classic',
    licenseKey: 'non-commercial-and-evaluation',
    contextMenu: false,
    viewportRowRenderingOffset: 10,
    viewportColumnRenderingOffset: 10, // some arbitrarily large number to ensure that the row heights are calculated correctly when the user scrolls to the right
    width: '100%',
    fixedColumnsStart: 2,
    wordWrap: true,
    autoRowSize: false,
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
    mapping: Map<number, { studyId: string; analysisId: string; isEdited: boolean }>,
    noteKeys: NoteKeyType[]
): NoteCollectionReturn[] => {
    const noteCollections: NoteCollectionReturn[] = hotData.map((row, index) => {
        const mappedStudyAnalysis = mapping.get(index);
        if (!mappedStudyAnalysis) {
            throw new Error(`No study analysis mapping found for row ${index}`);
        }

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
    hotDataToStudyMapping: Map<number, { studyId: string; analysisId: string; isEdited: boolean }>;
} => {
    const hotData = new Array<AnnotationNoteValue[]>();
    const hotDataToAnnotationMapping = new Map<number, { studyId: string; analysisId: string; isEdited: boolean }>();

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
                isEdited: false,
            });
            hotData.push(row);
        });

    return {
        hotData,
        hotDataToStudyMapping: hotDataToAnnotationMapping,
    };
};

export const createColumnHeader = (colKey: string, colType: EPropertyType, allowRemoveColumn: boolean) => {
    const allowRemove = allowRemoveColumn
        ? `<div class="${styles['column-header-remove']}">
        ${renderToString(
            <div className={styles['remove-column-icon']} style={{ width: '18px', height: '18px' }}>
                <RemoveCircle
                    style={{
                        width: '100%',
                        height: '100%',
                    }}
                />
            </div>
        )}
          </div>`
        : '<div></div>';

    return (
        `<div title="${colKey}" class="${styles['column-header']}">` +
        `<div class="${styles[colType]} ${styles.truncate} ${styles['column-header-label']}">${colKey}</div>` +
        allowRemove +
        `</div>`
    );
};

/** The SVG inside the remove button has pointer-events: none, so mouse events target this wrapper. */
export const isRemoveColumnButton = (target: EventTarget | null) =>
    target instanceof HTMLElement && target.classList.contains(styles['remove-column-icon']);

export const createColumnHeaders = (noteKeys: NoteKeyType[]) => [
    'Study',
    'Analysis',
    ...noteKeys.map((noteKey) => createColumnHeader(noteKey.key, noteKey.type, noteKey.key !== 'included')),
];

// note columns do not set readOnly so that the table level readOnly setting applies to them
export const createColumns = (noteKeys: NoteKeyType[]) =>
    [
        {
            className: `${styles['study-col']} ${styles['read-only-col']}`,
            readOnly: true,
        },
        {
            className: `${styles['read-only-col']} ${styles['truncate']}`,
            readOnly: true,
            wordWrap: false,
        },
        ...noteKeys.map((x) => {
            return {
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

/**
 * alter() cannot add or remove columns while the columns setting is defined, and updateSettings({ columns })
 * resets user column moves. hotData must therefore come from getData() (visual order) with the column change applied.
 */
export const reloadNoteColumns = (hot: Handsontable, hotData: AnnotationNoteValue[][], noteKeys: NoteKeyType[]) => {
    hot.loadData(hotData);
    hot.updateSettings({
        columns: createColumns(noteKeys),
        colHeaders: createColumnHeaders(noteKeys),
        colWidths: createColWidths(noteKeys, 300, 150, 150),
    });
};

/**
 * Mirrors how Handsontable's manualColumnMove reorders columns: the moved note keys are removed and then
 * inserted as a block at finalNoteKeyIndex of the remaining note keys.
 */
export const moveNoteKeys = (
    noteKeys: NoteKeyType[],
    movedNoteKeyIndexes: number[],
    finalNoteKeyIndex: number
): NoteKeyType[] => {
    const movedNoteKeys = movedNoteKeyIndexes.map((noteKeyIndex) => noteKeys[noteKeyIndex]);
    const remainingNoteKeys = noteKeys.filter((_, noteKeyIndex) => !movedNoteKeyIndexes.includes(noteKeyIndex));
    remainingNoteKeys.splice(finalNoteKeyIndex, 0, ...movedNoteKeys);
    return remainingNoteKeys.map((noteKey, index) => ({ ...noteKey, order: index }));
};

// we can assume that the hashmap maintains order and is sorted by key
// this function gets all merge cells and only merge cells. If a cell does not need to be merged, a mergeCellObj is not created
export const getMergeCells = (hotDataToStudyMapping: Map<number, { studyId: string; analysisId: string }>) => {
    const mergeCells: MergeCellRange[] = [];

    let studyId: string;
    let mergeCellObj: MergeCellRange = {
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

const getCalculatedRowHeight = (title: string, maxWidthInPx: number) => {
    const container = document.createElement('td');
    container.style.maxWidth = `${maxWidthInPx - 10}px`; // account for padding and borders
    container.style.width = `${maxWidthInPx - 10}px`; // account for padding and borders

    container.style.fontSize = '13px'; // handsontable default font size
    container.style.fontFamily =
        '-apple-system, system-ui, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Helvetica Neue", Arial, sans-serif';
    container.style.lineHeight = '21px'; // handsontable default line height
    container.style.border = '1px solid black';
    container.style.padding = '0px 4px';
    container.style.fontWeight = '400';
    container.style.display = 'table-cell';
    container.style.textAlign = 'center';

    container.innerText = title;
    document.body.appendChild(container);
    const height = container.offsetHeight;
    container.parentNode?.removeChild(container);
    return height;
};

export const getRowHeights = (hotData: AnnotationNoteValue[][], mergeCells: MergeCellRange[], maxWidthInPx: number) => {
    const rowHeights: number[] = [];
    let currIndex = 0;

    mergeCells.forEach(({ row, rowspan }) => {
        while (currIndex < row) {
            // sometimes the merge cells skip a few rows as they do not need to be merged.
            // we therefore need to account for that by calculting those row heights (which have rowspan = 1)
            const currIndexTitle = hotData[currIndex][0] as string;
            rowHeights.push(getCalculatedRowHeight(currIndexTitle, maxWidthInPx));
            currIndex++;
        }
        const title = hotData[row][0] as string;
        const height = getCalculatedRowHeight(title, maxWidthInPx);

        // Handsontable classic theme default row height is 26px; values below that are clamped.
        const themeMinRowHeight = 26;
        const potentialRowHeight = Math.ceil(height / rowspan);
        if (rowspan * themeMinRowHeight >= height) {
            // the title is smaller than the space taken up by the analyses
            for (let i = 0; i < rowspan; i++) {
                rowHeights.push(potentialRowHeight < themeMinRowHeight ? themeMinRowHeight : potentialRowHeight);
            }
        } else {
            // the title is bigger than the space taken up by the analyses
            // we want to split that space evenly
            for (let i = 0; i < rowspan; i++) {
                rowHeights.push(potentialRowHeight);
            }
        }
        currIndex = currIndex + rowspan;
    });
    return rowHeights;
};

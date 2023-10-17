import { HotTableProps } from '@handsontable/react';
import { EPropertyType } from 'components/EditMetadata';
import styles from 'components/HotTables/AnnotationsHotTable/AnnotationsHotTable.module.css';
import { EditStudyAnnotationsNoteCollectionReturn } from 'components/HotTables/EditStudyAnnotationsHotTable/EditStudyAnnotationsHotTable.types';
import { NoteKeyType } from 'components/HotTables/helpers/utils';
import { CellValue } from 'handsontable/common';
import { ColumnSettings } from 'handsontable/settings';
import { numericValidator } from 'handsontable/validators';
import { IStoreAnalysis } from 'pages/Studies/StudyStore.helpers';

export const HotSettings: HotTableProps = {
    licenseKey: 'non-commercial-and-evaluation',
    undo: false,
    width: '100%',
    selectionMode: 'range',
    contextMenu: false,
    allowRemoveColumn: false,
    allowRemoveRow: false,
    manualColumnResize: false,
    viewportRowRenderingOffset: 2,
    allowInsertColumn: false,
    viewportColumnRenderingOffset: 100,
    fixedColumnsStart: 2,
    fillHandle: {
        direction: 'vertical',
        autoInsertRow: false,
    },
};

export const booleanValidator = (value: CellValue, callback: (isValid: boolean) => void) => {
    const isValid =
        value === true ||
        value === false ||
        value === 'true' ||
        value === 'false' ||
        value === null ||
        value === '';
    callback(isValid);
};

export const createStudyAnnotationColHeaders = (noteKeys: NoteKeyType[]): string[] => {
    return [
        'Analysis Name',
        'Analysis Description',
        ...noteKeys.map((x) => `<div class="${styles[x.type]}">${x.key}</div>`),
    ];
};

export const createStudyAnnotationColWidths = (noteKeys: NoteKeyType[]): number[] => {
    return [200, 250, ...noteKeys.map((x) => 150)];
};

export const createStudyAnnotationColumns = (noteKeys: NoteKeyType[]) =>
    [
        {
            className: `${styles['study-col']} ${styles['read-only-col']}`,
            readOnly: true,
            data: 'analysis_name',
        },
        {
            className: styles['read-only-col'],
            readOnly: true,
            data: 'analysisDescription',
        },
        ...noteKeys.map((x) => {
            return {
                readOnly: false,
                data: `note.${x.key}`,
                className: styles[x.type],
                allowInvalid: false,
                type:
                    x.type === EPropertyType.BOOLEAN
                        ? 'checkbox'
                        : x.type === EPropertyType.NUMBER
                        ? 'numeric'
                        : 'text',
                validator:
                    x.type === EPropertyType.NUMBER
                        ? numericValidator
                        : x.type === EPropertyType.BOOLEAN
                        ? booleanValidator
                        : undefined,
            } as ColumnSettings;
        }),
    ] as ColumnSettings[];

export const sortAndReplaceNotesDataWithAnalyses = (
    notes: EditStudyAnnotationsNoteCollectionReturn[],
    analyses: IStoreAnalysis[]
) => {
    const sortedNotesByAnalysis: EditStudyAnnotationsNoteCollectionReturn[] = [];

    analyses.forEach((analysis) => {
        const foundNoteForAnalysis = notes.find((someNote) => someNote.analysis === analysis.id);
        if (foundNoteForAnalysis) {
            sortedNotesByAnalysis.push({
                ...foundNoteForAnalysis,
                analysis_name: analysis.name,
                analysisDescription: analysis.description || '',
            });
        }
    });
    return sortedNotesByAnalysis;
};

export const sanitizeChange = (val: any, colType: EPropertyType) => {
    switch (colType) {
        case EPropertyType.BOOLEAN:
            if (typeof val === 'boolean') return val;
            if (val === 'true') return true;
            if (val === 'false') return false;
            break;
        case EPropertyType.NUMBER:
            if (typeof val === 'number') return val;
            if (typeof val === 'string') {
                const strToNum = parseInt(val);
                return isNaN(strToNum) ? undefined : strToNum;
            }
            break;
        case EPropertyType.STRING:
            if (typeof val === 'string') return val;
            if (typeof val === 'boolean' || typeof val === 'number') return val.toString();
            break;
    }

    return undefined;
};

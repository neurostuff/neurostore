import { HotTableProps } from '@handsontable/react-wrapper';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import {
    EditStudyAnnotationsNoteCollectionReturn,
    IEditStudyAnnotationsDataRef,
} from 'pages/StudyCBMA/components/EditStudyAnnotationsHotTable.types';
import styles from 'components/HotTables/HotTables.module.css';
import { NoteKeyType } from 'components/HotTables/HotTables.types';
import { ColumnSettings } from 'handsontable/settings';
import { numericValidator } from 'handsontable/validators';
import { IStoreAnalysis } from 'stores/study/StudyStore.helpers';
import { booleanValidator, createColWidths } from 'components/HotTables/HotTables.utils';
import { createColumnHeader } from 'pages/Annotations/components/EditAnnotationsHotTable.helpers';

export const HotSettings: HotTableProps = {
    theme: 'ht-theme-classic',
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
    fixedColumnsStart: 1,
    fillHandle: {
        direction: 'vertical',
        autoInsertRow: false,
    },
};

export const createStudyAnnotationColumns = (noteKeys: NoteKeyType[], readonly: boolean) =>
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
                readOnly: readonly,
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

export const createStudyAnnotationColumnSettings = (
    noteKeys: NoteKeyType[],
    readonly: boolean
): IEditStudyAnnotationsDataRef => ({
    columns: createStudyAnnotationColumns(noteKeys, readonly),
    colHeaders: [
        'Analysis Name',
        'Analysis Description',
        ...noteKeys.map((x) => createColumnHeader(x.key, x.type, x.key !== 'included')),
    ],
    colWidths: createColWidths(noteKeys, 150, 150, 150),
});

/** Source for changes the app writes into the table (analysis details, new rows and columns), so afterChange skips them. */
export const STUDY_ANNOTATIONS_SYNC_SOURCE = 'studyAnnotationsSync';

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

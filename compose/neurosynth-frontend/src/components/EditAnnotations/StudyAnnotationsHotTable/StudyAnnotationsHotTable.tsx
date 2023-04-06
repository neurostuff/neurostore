import HotTable, { HotTableProps } from '@handsontable/react';
import { Box } from '@mui/material';
import { EPropertyType, IMetadataRowModel, getType } from 'components/EditMetadata';
import AddMetadataRow from 'components/EditMetadata/EditMetadataRow/AddMetadataRow';
import { CellChange, CellValue, ChangeSource } from 'handsontable/common';
import { registerAllModules } from 'handsontable/registry';
import { ColumnSettings } from 'handsontable/settings';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from 'components/EditAnnotations/AnnotationsHotTable/AnnotationsHotTable.module.css';
import { Cancel } from '@mui/icons-material';
import { DetailedSettings as MergeCellsSettings } from 'handsontable/plugins/mergeCells';
import { AnnotationNoteValue, NoteKeyType } from '../helpers/utils';
import { numericValidator } from 'handsontable/validators';
import { renderToString } from 'react-dom/server';
import { CellCoords } from 'handsontable';
import React from 'react';

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

const createColumns = (noteKeys: NoteKeyType[]) => [
    {
        className: `${styles['read-only-col']}`,
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

// const createColumnHeader = (
//     colKey: string,
//     colType: EPropertyType,
//     updateFunc: (key: string) => void
// ) =>
//     `<div style="display: flex; align-items: center; justify-content: center; min-width: 160px">` +
//     `<div class=${styles[colType]}>${colKey}</div>` +
//     `<div style="width: 50px;">${renderToString(
//         <Cancel
//             onClick={() => updateFunc(colKey)}
//             sx={{ ':hover': { color: 'error.light', cursor: 'pointer' } }}
//             color="error"
//         />
//     )}</div>` +
//     `</div>`;

const hotSettings: HotTableProps = {
    fillHandle: false,
    licenseKey: 'non-commercial-and-evaluation',
    contextMenu: false,
    viewportRowRenderingOffset: 2,
    viewportColumnRenderingOffset: 2,
    width: '100%',
    fixedColumnsStart: 2,
};

registerAllModules();

const StudyAnnotationsHotTable: React.FC<{
    onChange: (hotData: AnnotationNoteValue[][], updatedNoteKeys: NoteKeyType[]) => void;
    hotData: AnnotationNoteValue[][];
    noteKeys: NoteKeyType[];
}> = React.memo((props) => {
    const hotTableRef = useRef<HotTable>(null);
    const hotStateRef = useRef<{
        noteKeys: NoteKeyType[];
    }>({
        noteKeys: [],
    });
    const { noteKeys: initialNoteKeys, hotData, onChange } = props;

    // set handsontable ref height if the (debouneced) window height changes.
    // Must do this via an eventListener to avoid react re renders clearing the HOT State
    useEffect(() => {
        let timeout: any;
        const handleResize = () => {
            const currentWindowSize = window.innerHeight;
            if (currentWindowSize) {
                if (timeout) clearTimeout(timeout);
                timeout = setTimeout(async () => {
                    if (hotTableRef.current?.hotInstance) {
                        const navHeight = '64px';
                        const breadCrumbHeight = '44px';
                        const addMetadataHeight = '1rem + 40px + 25px';
                        const bottomSaveButtonHeight = '2.5rem';
                        const pageMarginHeight = '4rem';
                        hotTableRef.current.hotInstance.updateSettings({
                            height: `calc(${currentWindowSize}px - ${navHeight} - ${breadCrumbHeight} - (${addMetadataHeight}) - ${bottomSaveButtonHeight} - ${pageMarginHeight})`,
                        });
                    }
                }, 200);
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize();

        return () => {
            if (timeout) clearTimeout(timeout);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    const [initialHotState, setInitialHotState] = useState<{
        initialHotData: AnnotationNoteValue[][];
        initialHotColumns: ColumnSettings[];
        intialHotColumnHeaders: string[];
    }>({
        initialHotData: [],
        initialHotColumns: [],
        intialHotColumnHeaders: [],
    });

    const handleRemoveHotColumn = useCallback(
        (colKey: string) => {
            if (!hotTableRef.current?.hotInstance) return;

            const foundIndex = hotStateRef.current.noteKeys.findIndex((x) => x.key === colKey);
            if (foundIndex < 0) return;

            const noteKeys = hotStateRef.current.noteKeys;
            const colHeaders = hotTableRef.current.hotInstance.getColHeader() as string[];
            const data = hotTableRef.current.hotInstance.getData() as AnnotationNoteValue[][];

            noteKeys.splice(foundIndex, 1);
            const columns = createColumns(noteKeys);

            colHeaders.splice(foundIndex + 2, 1);
            data.forEach((row) => {
                row.splice(foundIndex + 2, 1);
            });

            hotTableRef.current.hotInstance.updateSettings({
                data: data,
                colHeaders: colHeaders,
                columns: columns,
            });

            onChange(
                hotTableRef.current.hotInstance.getData() as AnnotationNoteValue[][],
                noteKeys
            );
        },
        [onChange]
    );

    const handleCellMouseUp = (
        event: MouseEvent,
        coords: CellCoords,
        TD: HTMLTableCellElement
    ): void => {
        const target = event.target as HTMLButtonElement;
        if (coords.row < 0 && (target.tagName === 'svg' || target.tagName === 'path')) {
            handleRemoveHotColumn(TD.innerText);
        }
    };

    const handleChangeOccurred = (changes: CellChange[] | null, source: ChangeSource) => {
        // this hook is triggered during merge cells and on initial update. We don't want the parent to be notified unless its a real user change
        if (!changes || changes.some((x) => x[1] === 0)) return;
        if (hotTableRef.current?.hotInstance) {
            const hotData = hotTableRef.current.hotInstance.getData() as AnnotationNoteValue[][];
            onChange(hotData, hotStateRef.current.noteKeys);
        }
    };

    useEffect(() => {
        setInitialHotState((state) => {
            hotStateRef.current.noteKeys = JSON.parse(JSON.stringify(initialNoteKeys));

            return {
                initialHotData: JSON.parse(JSON.stringify(hotData)),
                initialHotColumns: createColumns(initialNoteKeys),
                intialHotColumnHeaders: [
                    'Analysis Name',
                    'Description',
                    ...initialNoteKeys.map((col) => col.key),
                ],
            };
        });
    }, [hotData, initialNoteKeys, handleRemoveHotColumn]);

    return (
        <Box>
            <HotTable
                {...hotSettings}
                id="hot-annotations"
                afterChange={handleChangeOccurred}
                ref={hotTableRef}
                preventOverflow="horizontal"
                colHeaders={initialHotState.intialHotColumnHeaders}
                columns={initialHotState.initialHotColumns}
                data={initialHotState.initialHotData}
                afterOnCellMouseUp={handleCellMouseUp}
            />
        </Box>
    );
});

export default StudyAnnotationsHotTable;

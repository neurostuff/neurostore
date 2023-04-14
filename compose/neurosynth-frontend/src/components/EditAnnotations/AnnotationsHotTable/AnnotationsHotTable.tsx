import HotTable, { HotTableProps } from '@handsontable/react';
import { Box, Typography } from '@mui/material';
import { IMetadataRowModel, getType } from 'components/EditMetadata';
import AddMetadataRow from 'components/EditMetadata/EditMetadataRow/AddMetadataRow';
import { CellChange, ChangeSource } from 'handsontable/common';
import { registerAllModules } from 'handsontable/registry';
import { ColumnSettings } from 'handsontable/settings';
import { useCallback, useEffect, useRef } from 'react';
import { DetailedSettings } from 'handsontable/plugins/mergeCells';
import { AnnotationNoteValue, NoteKeyType } from '../helpers/utils';
import { CellCoords } from 'handsontable';
import React from 'react';
import { createColumnHeader, createColumns } from '../helpers/utils';

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

/**
 * Note: this component preserves the state of the handsontable when manipulating data for performance reasons.
 * As a result, it avoids rerenders.
 */
const AnnotationsHotTable: React.FC<{
    allowAddColumn?: boolean;
    hardCodedReadOnlyCols: string[];
    allowRemoveColumns?: boolean;
    onChange: (hotData: AnnotationNoteValue[][], updatedNoteKeys: NoteKeyType[]) => void;
    hotData: AnnotationNoteValue[][];
    noteKeys: NoteKeyType[];
    mergeCells: DetailedSettings[];
    hotColumns: ColumnSettings[];
}> = React.memo((props) => {
    console.log('render');
    const hotTableRef = useRef<HotTable>(null);
    const hotStateRef = useRef<{
        noteKeys: NoteKeyType[];
    }>({
        noteKeys: [],
    });
    const { noteKeys, hotData, mergeCells, onChange, hotColumns, hardCodedReadOnlyCols } = props;

    useEffect(() => {
        // make a copy as we don't want to modify the original
        hotStateRef.current.noteKeys = noteKeys.map((x) => ({ ...x }));
    }, [noteKeys]);

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

    const handleAddHotColumn = (row: IMetadataRowModel) => {
        if (!hotTableRef.current?.hotInstance) return false;

        if (hotStateRef.current.noteKeys.find((x) => x.key === row.metadataKey)) return false;

        const noteKeys = hotStateRef.current.noteKeys;
        const colHeaders = hotTableRef.current.hotInstance.getColHeader() as string[];
        const data = hotTableRef.current.hotInstance.getData() as AnnotationNoteValue[][];

        noteKeys.unshift({ key: row.metadataKey, type: getType(row.metadataValue) });
        const columns = createColumns(noteKeys);

        colHeaders.splice(
            2,
            0,
            createColumnHeader(
                row.metadataKey,
                getType(row.metadataValue),
                props.allowRemoveColumns ? handleRemoveHotColumn : undefined
            )
        );

        data.forEach((row) => {
            row.splice(2, 0, null);
        });

        hotTableRef.current.hotInstance.updateSettings({
            data: data,
            colHeaders: colHeaders,
            columns: columns,
        });

        onChange(hotTableRef.current.hotInstance.getData() as AnnotationNoteValue[][], noteKeys);

        return true;
    };

    const handleChangeOccurred = (changes: CellChange[] | null, source: ChangeSource) => {
        // this hook is triggered during merge cells and on initial update. We don't want the parent to be notified unless its a real user change
        if (!changes || changes.some((x) => x[1] === 0)) return;
        if (hotTableRef.current?.hotInstance) {
            const hotData = hotTableRef.current.hotInstance.getData() as AnnotationNoteValue[][];
            onChange(hotData, hotStateRef.current.noteKeys);
        }
    };

    const intialHotColumnHeaders = [
        ...hardCodedReadOnlyCols,
        ...noteKeys.map((col) =>
            createColumnHeader(
                col.key,
                col.type,
                props.allowRemoveColumns ? handleRemoveHotColumn : undefined
            )
        ),
    ];

    return (
        <Box>
            {props.allowAddColumn && (
                <Box
                    sx={{
                        display: 'table',
                        height: '100%',
                        borderCollapse: 'separate',
                        borderSpacing: '12px 0px',
                        margin: '1rem 0 25px 0',
                    }}
                >
                    <AddMetadataRow
                        keyPlaceholderText="New Annotation Key"
                        onAddMetadataRow={handleAddHotColumn}
                        showMetadataValueInput={false}
                        allowNoneOption={false}
                    />
                </Box>
            )}
            <Box>
                {hotData.length > 0 ? (
                    <HotTable
                        {...hotSettings}
                        id="hot-annotations"
                        afterChange={handleChangeOccurred}
                        ref={hotTableRef}
                        preventOverflow="horizontal"
                        mergeCells={mergeCells}
                        colHeaders={intialHotColumnHeaders}
                        columns={hotColumns}
                        data={JSON.parse(JSON.stringify(hotData))}
                        afterOnCellMouseUp={handleCellMouseUp}
                    />
                ) : (
                    <Typography sx={{ color: 'warning.dark' }}>
                        There are no analyses to annotate. Get started by adding analyses to your
                        studies.
                    </Typography>
                )}
            </Box>
        </Box>
    );
});

export default AnnotationsHotTable;

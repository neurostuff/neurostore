import { Box } from '@mui/system';
import { EPropertyType } from '..';
import { IconButton, Paper } from '@mui/material';
import React, { KeyboardEvent, useEffect } from 'react';
import HotTable, { HotColumn } from '@handsontable/react';
import { GridSettings } from 'handsontable/settings';
import DeleteIcon from '@mui/icons-material/Delete';
import { renderToString } from 'react-dom/server';
import CellCoords from 'handsontable/3rdparty/walkontable/src/cell/coords';
import styles from './NeurosynthSpreadsheet.module.css';
import { numericValidator } from 'handsontable/validators';
import { CellChange } from 'handsontable/common';

export interface INeurosynthCell {
    value: string;
    type: EPropertyType;
}

export interface INeurosynthSpreadsheetData {
    rowHeaderValues: string[];
    columnHeaderValues: INeurosynthCell[];
    data: (string | number)[][];
    onColumnDelete: (colDeleted: number) => void;
    // onCellUpdate: (
    //     coordinates: { x: number; y: number },
    //     newVal: string | number | boolean
    // ) => void;
}

const NeurosynthSpreadsheet: React.FC<INeurosynthSpreadsheetData> = (props) => {
    const HOT_LICENSE_KEY = 'non-commercial-and-evaluation';

    const handleOnHeaderClick = (
        event: MouseEvent,
        coords: CellCoords,
        TD: HTMLTableCellElement
    ) => {
        const target = event.target as HTMLButtonElement;

        if (target.tagName === 'svg' || target.tagName === 'path') {
            props.onColumnDelete(coords.col);
        }
    };

    const handleSetData = (changes: CellChange[]) => {
        console.log(changes);
    };

    const hotSettings: GridSettings = {
        data: props.data,
        licenseKey: HOT_LICENSE_KEY,
        rowHeaders: props.rowHeaderValues,
        rowHeaderWidth: 150,
        afterSetDataAtCell: handleSetData,
        columns: props.columnHeaderValues.map((col) => {
            return {
                copyable: false,
                readOnly: col.type === EPropertyType.NONE,
                className: styles[col.type],
                allowInvalid: false,
                validator: col.type === EPropertyType.NUMBER ? numericValidator : undefined,
            };
        }),
        afterOnCellMouseDown: handleOnHeaderClick,
        colHeaders: props.columnHeaderValues.map((col) => {
            const deleteIconStr = renderToString(<DeleteIcon className={styles['delete-icon']} />);
            return `
                <div class="${styles['column-header']}"
                >
                    <span class="${styles[col.type]}"><b>${col.value}</b></span>
                    ${deleteIconStr}
                </div>
            `;
        }),

        contextMenu: false,
    };

    return (
        <Box component={Paper} sx={{ padding: '10px' }}>
            {props.columnHeaderValues.length === 0 && (
                <Box sx={{ color: 'warning.dark', margin: '1rem 0' }}>
                    There are no notes for this annotation
                </Box>
            )}
            <HotTable settings={hotSettings}></HotTable>
        </Box>
    );

    // const { data, rowLabelValues, columnLabelValues, onColumnDelete } = props;

    // const handleOnSpreadsheetChange = (newData: Matrix<CellBase<INeurosynthCell>>) => {};

    // /**ands
    //  * Hack: In order to pass a function prop into the column indicator, we need to cast this to "any" and
    //  * override the original string[] typing.
    //  */
    // const columnLabels = columnLabelValues.map((obj) => ({
    //     ...obj,
    //     onColumnDelete,
    // })) as any;

    // const handleCellCommit = (
    //     prevCell: CellBase<INeurosynthCell> | null,
    //     nextCell: CellBase<INeurosynthCell> | null,
    //     coords: Point | null
    // ) => {
    //     if (nextCell === null) return;

    //     const cellVal = nextCell.value.text;

    //     // do type check and propagate change. nextCell is the cell that is being modified
    //     switch (nextCell.value.type) {
    //         case EPropertyType.STRING:
    //             if (typeof cellVal === 'string') {
    //                 props.onCellUpdate();
    //             }
    //             break;
    //         case EPropertyType.NUMBER:
    //             break;

    //         case EPropertyType.BOOLEAN:
    //             break;

    //         default:
    //             break;
    //     }
    // };

    // const handleKeyDown = (event: KeyboardEvent) => {
    //     const eventTarget = event.target as HTMLDivElement;
    //     if (eventTarget.className.includes('readonly') && event.key === 'Backspace')
    //         event.preventDefault();
    // };

    // return (
    //     <>
    //         {data && (
    //             <Box
    //                 component={Paper}
    //                 elevation={2}
    //                 sx={{
    //                     padding: '20px',
    //                     overflowX: 'scroll',
    //                     display: 'flex',
    //                     flexDirection: 'column',
    //                 }}
    //             >
    //                 {columnLabelValues.length === 0 && (
    //                     <Box component="span" sx={{ color: 'warning.dark', margin: '1rem 0' }}>
    //                         No notes have been added to this annotation yet
    //                     </Box>
    //                 )}
    //                 <Box
    //                     component={Spreadsheet}
    //                     rowLabels={rowLabelValues}
    //                     columnLabels={columnLabels}
    //                     onChange={handleOnSpreadsheetChange}
    //                     data={data}
    //                     ColumnIndicator={NeurosynthColumnIndicator}
    //                     DataEditor={NeurosynthDataEditor}
    //                     DataViewer={NeurosynthDataViewer}
    //                     onCellCommit={handleCellCommit}
    //                     onKeyDown={handleKeyDown}
    //                 />
    //             </Box>
    //         )}
    //     </>
    // );
};

export default NeurosynthSpreadsheet;

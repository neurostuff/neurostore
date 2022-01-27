import { Box } from '@mui/system';
import { EPropertyType } from '..';
import React, { useRef } from 'react';
import HotTable, { HotColumn } from '@handsontable/react';
import { GridSettings } from 'handsontable/settings';
import DeleteIcon from '@mui/icons-material/Delete';
import { renderToString } from 'react-dom/server';
import CellCoords from 'handsontable/3rdparty/walkontable/src/cell/coords';
import styles from './NeurosynthSpreadsheet.module.css';
import { numericValidator } from 'handsontable/validators';
import { CellChange, CellValue } from 'handsontable/common';
import { textRenderer, numericRenderer } from 'handsontable/renderers';
import { getType } from '../EditMetadata/EditMetadata';
import { useAuth0 } from '@auth0/auth0-react';

export interface INeurosynthCell {
    value: string;
    type: EPropertyType;
}

export const isSpreadsheetBoolType = (value: any): boolean => {
    return (
        value === 't' ||
        value === 'f' ||
        value === 'true' ||
        value === true ||
        value === false ||
        value === 'false' ||
        value === '' || // case where user presses enter after deleting cell contents
        value === null // case where user deletes the cell
    );
};

export interface INeurosynthSpreadsheetData {
    rowHeaderValues: string[];
    columnHeaderValues: INeurosynthCell[];
    data: (string | number | boolean | null)[][];
    onColumnDelete: (colDeleted: number) => void;
    onCellUpdates: (changes: CellChange[]) => void;
}

const NeurosynthSpreadsheet: React.FC<INeurosynthSpreadsheetData> = (props) => {
    const { isAuthenticated } = useAuth0();
    const HOT_LICENSE_KEY = 'non-commercial-and-evaluation';
    const ROW_HEIGHTS = 25;
    const hotTableRef = useRef<HotTable>(null);

    const getValidator = (type: EPropertyType) => {
        switch (type) {
            case EPropertyType.NUMBER:
                return numericValidator;
            case EPropertyType.BOOLEAN:
                return (value: CellValue, callback: (valid: boolean) => void) => {
                    const isValid = isSpreadsheetBoolType(value);
                    return callback(isValid);
                };
            default:
                return undefined;
        }
    };

    const getTransformedValue = (type: EPropertyType, value: any) => {
        switch (type) {
            case EPropertyType.BOOLEAN:
                if (value === 't' || value === 'true') {
                    return true;
                }
                if (value === 'f' || value === 'false' || value === null || value === '') {
                    return false;
                }
                return value;
            case EPropertyType.NUMBER:
                if (value === null || value === '') {
                    return 0;
                }
                return value;
            case EPropertyType.STRING:
                if (value === null) {
                    return '';
                }
                return value;
            default:
                return value;
        }
    };

    const handleOnHeaderClick = (
        event: MouseEvent,
        coords: CellCoords,
        TD: HTMLTableCellElement
    ) => {
        const target = event.target as HTMLButtonElement;
        if (target.tagName === 'svg' || target.tagName === 'path') props.onColumnDelete(coords.col);
    };

    const handleSetData = (changes: CellChange[]) => {
        props.onCellUpdates(changes);
    };

    const hotSettings: GridSettings = {
        data: props.data,
        licenseKey: HOT_LICENSE_KEY,
        rowHeaders: props.rowHeaderValues,
        rowHeaderWidth: 150,
        afterSetDataAtCell: handleSetData,
        afterChange: (changes: CellChange[] | null) => {
            if (changes && hotTableRef.current && hotTableRef.current.hotInstance) {
                const updatedChanges: [number, number, any][] = [];

                for (let i = 0; i < changes.length; i++) {
                    const change = changes[i];

                    const oldValue = change[2];
                    const newValue = change[3];

                    const isValidBoolInput =
                        getType(oldValue) === EPropertyType.BOOLEAN &&
                        isSpreadsheetBoolType(newValue);
                    const numberRequiresChange =
                        getType(oldValue) === EPropertyType.NUMBER && newValue === '';

                    if (
                        newValue === null ||
                        isValidBoolInput || // this case exists because we need to convert valid boolean values to booleans
                        numberRequiresChange
                    ) {
                        updatedChanges.push([
                            change[0],
                            change[1] as number,
                            getTransformedValue(getType(oldValue), newValue),
                        ]);
                    }
                }

                if (updatedChanges.length > 0)
                    hotTableRef.current.hotInstance.setDataAtCell(updatedChanges);
            }
        },
        rowHeights: ROW_HEIGHTS,
        columns: props.columnHeaderValues.map((col) => {
            return {
                copyable: false,
                readOnly: col.type === EPropertyType.NONE || !isAuthenticated,
                type: col.type === EPropertyType.NUMBER ? 'numeric' : 'text',
                className: styles[col.type],
                allowInvalid: false,
                validator: getValidator(col.type),
                renderer: col.type === EPropertyType.NUMBER ? numericRenderer : textRenderer,
            };
        }),
        afterOnCellMouseDown: handleOnHeaderClick,
        afterGetColHeader: (column: number, TH: HTMLElement) => {
            const isBoolType = TH.querySelector(`.${styles['boolean']}`);

            if (TH && isBoolType) {
                TH.setAttribute(
                    'title',
                    'valid boolean entries include "t" or "true" for true and "f" or "false" for false.'
                );
            }
        },
        colHeaders: props.columnHeaderValues.map((col) => {
            const deleteIconStr = renderToString(<DeleteIcon className={styles['delete-icon']} />);
            return `
                <div class="${styles['column-header']}"
                >
                    <span class="${styles[col.type]}"><b>${col.value}</b></span>
                    ${isAuthenticated ? deleteIconStr : '<span></span>'}
                </div>
            `;
        }),

        contextMenu: false,
    };

    const getSpreadsheetContainerHeight = (): string => {
        // extra height to take borders into account
        const extraHeaderHeight = 5;
        return `${(props.rowHeaderValues.length + 1) * ROW_HEIGHTS + extraHeaderHeight}px`;
    };

    return (
        <Box component="div">
            {props.columnHeaderValues.length === 0 && (
                <Box sx={{ color: 'warning.dark', height: '35px' }}>
                    There are no notes for this annotation yet
                </Box>
            )}
            <Box
                component="div"
                sx={{ overflowX: 'auto', height: getSpreadsheetContainerHeight() }}
            >
                <HotTable ref={hotTableRef} settings={hotSettings}></HotTable>
            </Box>
        </Box>
    );
};

export default NeurosynthSpreadsheet;

import { textRenderer, numericRenderer } from 'handsontable/renderers';
import { useAuth0 } from '@auth0/auth0-react';
import HotTable from '@handsontable/react';
import { GridSettings } from 'handsontable/settings';
import DeleteIcon from '@mui/icons-material/Delete';
import { renderToString } from 'react-dom/server';
import CellCoords from 'handsontable/3rdparty/walkontable/src/cell/coords';
import styles from './NeurosynthSpreadsheet.module.css';
import { CellChange, CellValue } from 'handsontable/common';
import { numericValidator } from 'handsontable/validators';
import { useRef, memo } from 'react';
import { EPropertyType } from '../..';
import { Box } from '@mui/system';
import { INeurosynthSpreadsheetData } from '..';

export const isSpreadsheetBoolType = (value: any): boolean => {
    return (
        value === 't' ||
        value === 'f' ||
        value === 'true' ||
        value === 'false' ||
        value === null ||
        value === true ||
        value === false ||
        value === ''
    );
};

const NeurosynthSpreadsheet: React.FC<INeurosynthSpreadsheetData> = memo((props) => {
    const { data, onColumnDelete, onCellUpdates, columnHeaderValues, rowHeaderValues } = props;
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

    const handleOnHeaderClick = (
        event: MouseEvent,
        coords: CellCoords,
        TD: HTMLTableCellElement
    ) => {
        const target = event.target as HTMLButtonElement;
        if (target.tagName === 'svg' || target.tagName === 'path')
            onColumnDelete(coords.col, columnHeaderValues[coords.col].value);
    };

    const hotSettings: GridSettings = {
        data: data,
        licenseKey: HOT_LICENSE_KEY,
        rowHeaders: rowHeaderValues,
        rowHeaderWidth: 150,
        afterSetDataAtCell: onCellUpdates,
        afterChange: (changes: CellChange[] | null) => {
            console.log(hotTableRef);

            if (changes && hotTableRef.current && hotTableRef.current.hotInstance) {
                const updatedChanges: [number, number, any][] = [];

                for (let i = 0; i < changes.length; i++) {
                    const change = changes[i];

                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const [rowValue, colValue, _, newValue] = change;

                    const columnIndex = columnHeaderValues.findIndex(
                        (colHeaderVal) => colHeaderVal.value === colValue
                    );
                    if (columnIndex < 0) throw new Error('could not find nonexistent column');
                    const column = columnHeaderValues[columnIndex];

                    const isValidSpreadsheetBooleanValueAndRequiresChange =
                        column.type === EPropertyType.BOOLEAN &&
                        newValue !== true &&
                        newValue !== false &&
                        newValue !== null;

                    if (isValidSpreadsheetBooleanValueAndRequiresChange) {
                        let transformedValue = null;
                        switch (newValue) {
                            case '':
                            case null:
                                transformedValue = null;
                                break;
                            case 't':
                            case 'true':
                                transformedValue = true;
                                break;
                            default:
                                transformedValue = false;
                                break;
                        }

                        updatedChanges.push([rowValue, columnIndex, transformedValue]);
                    }
                }
                if (updatedChanges.length > 0)
                    hotTableRef.current.hotInstance.setDataAtCell(updatedChanges);
            }
        },
        rowHeights: ROW_HEIGHTS,
        columns: columnHeaderValues.map((col) => {
            return {
                copyable: false,
                data: col.value,
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
        colHeaders: columnHeaderValues.map((col) => {
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
        const totalHeightInPixels = (rowHeaderValues.length + 1) * ROW_HEIGHTS + extraHeaderHeight;
        return totalHeightInPixels > 600 ? '600px' : `${totalHeightInPixels}px`;
    };

    return (
        <Box
            component="div"
            sx={{ overflowX: 'auto', height: getSpreadsheetContainerHeight(), overflowY: 'auto' }}
        >
            <HotTable ref={hotTableRef} settings={hotSettings} />
        </Box>
    );
});

export default NeurosynthSpreadsheet;

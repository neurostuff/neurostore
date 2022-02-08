import { textRenderer, numericRenderer } from 'handsontable/renderers';
import { useAuth0 } from '@auth0/auth0-react';
import HotTable from '@handsontable/react';
import { CellMeta, CellProperties, GridSettings } from 'handsontable/settings';
import DeleteIcon from '@mui/icons-material/Delete';
import { renderToString } from 'react-dom/server';
import CellCoords from 'handsontable/3rdparty/walkontable/src/cell/coords';
import styles from './NeurosynthSpreadsheet.module.css';
import { CellChange, CellValue } from 'handsontable/common';
import { numericValidator } from 'handsontable/validators';
import { memo, useRef } from 'react';
import { EPropertyType } from '../..';
import { Box } from '@mui/system';
import { Link } from '@mui/material';
import { INeurosynthSpreadsheetData } from '..';
import { NavLink } from 'react-router-dom';

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { data, onColumnDelete, onCellUpdates, columnHeaderValues, rowHeaderValues } = props;
    const { isAuthenticated } = useAuth0();
    const HOT_LICENSE_KEY = 'non-commercial-and-evaluation';
    const ROW_HEIGHTS = 25;
    const hotTableRef = useRef<HotTable>(null);

    const studyTitleRows: number[] = [];
    data.forEach((row, index) => {
        if (row._isStudyTitle) {
            studyTitleRows.push(index);
        }
    });

    const rowIsStudyTitle = (row: number): boolean => {
        return studyTitleRows.includes(row);
    };

    const getMergeCells = (
        rowsThatRequireMerging: number[]
    ): { row: number; col: number; rowspan: number; colspan: number }[] => {
        if (columnHeaderValues.length === 0 || columnHeaderValues.length === 1) return [];

        return rowsThatRequireMerging.map((rowNum) => ({
            row: rowNum,
            col: 0,
            rowspan: 1,
            colspan: columnHeaderValues.length,
        }));
    };

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
        if (
            target.tagName === 'svg' ||
            (target.tagName === 'path' && columnHeaderValues.length > coords.col)
        )
            onColumnDelete(coords.col, columnHeaderValues[coords.col].value);
    };

    const getSpreadsheetContainerHeight = (): string => {
        // extra height to take borders into account
        const extraHeaderHeight = 5;
        const totalHeightInPixels = (rowHeaderValues.length + 1) * ROW_HEIGHTS + extraHeaderHeight;
        return totalHeightInPixels > 600 ? '600px' : `${totalHeightInPixels}px`;
    };

    const hotSettings: GridSettings = {
        data: data,
        maxRows: data.length,
        licenseKey: HOT_LICENSE_KEY,
        rowHeaders: rowHeaderValues,
        rowHeaderWidth: 150,
        rowHeights: ROW_HEIGHTS,
        mergeCells: getMergeCells(studyTitleRows),
        cells: function (
            this: CellProperties,
            row: number,
            column: number,
            prop: string | number
        ): CellMeta {
            const cellProperties: any = {};
            if (rowIsStudyTitle(row)) {
                cellProperties.readOnly = true;
                cellProperties['className'] = styles['some-class-name'];
            }
            return cellProperties;
        },
        fillHandle: false,
        beforeChange: function (changes: CellChange[], source) {
            /**
             * Prevent study name from being selectable and copyable
             */
            if (columnHeaderValues.length <= 0) return;

            changes.forEach((change, index) => {
                const [rowValue, colValue, _, newValue] = change;

                const col = columnHeaderValues.find((col) => col.value === colValue);
                if (col === undefined || rowIsStudyTitle(rowValue)) {
                    changes[index] = null as any;
                    return;
                }

                const isValidSpreadsheetBooleanValueAndRequiresChange =
                    col.type === EPropertyType.BOOLEAN &&
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

                    changes[index][3] = transformedValue;
                }
            });
        },
        afterSetDataAtCell: function (changes: CellChange[], source) {
            // we don't want to update when data is set due to irrelevant actions
            if (source === 'populateFromArray') return;
            const updatedChanges = changes.filter((change) => !rowIsStudyTitle(change[0]));
            if (updatedChanges.length > 0) onCellUpdates(updatedChanges);
        },
        beforeOnCellMouseDown: function (event: MouseEvent, coords: CellCoords, TH: HTMLElement) {
            /**
             * Prevent study name from being selectable and copyable
             */
            if (rowIsStudyTitle(coords.row)) {
                event.stopImmediatePropagation();
            }
        },
        columns: columnHeaderValues.map((col) => {
            return {
                copyable: true,
                data: col.value, // handsontable reads the data and gets the value that has col.value as its key
                readOnly: col.type === EPropertyType.NONE || !isAuthenticated,
                type: col.type === EPropertyType.NUMBER ? 'numeric' : 'text',
                className: styles[col.type],
                allowInvalid: false,
                validator: getValidator(col.type),
                renderer: col.type === EPropertyType.NUMBER ? numericRenderer : textRenderer,
            };
        }),
        afterOnCellMouseDown: handleOnHeaderClick,
        stretchH: 'all',
        afterGetRowHeader: function (row, TH: HTMLElement) {
            /**
             * style the row header if it is a study title row
             */
            if (rowIsStudyTitle(row)) {
                TH.setAttribute(
                    'style',
                    'background-color: #ccc; color: black; border-left-color: #ccc; border-right-color: #ccc;'
                );
            }
        },
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
        height: getSpreadsheetContainerHeight(),
        width: '100%',
    };

    const canShowTable = rowHeaderValues.length > 0;

    return (
        <>
            {columnHeaderValues.length === 0 && canShowTable && (
                <Box sx={{ color: 'warning.dark', height: '35px' }}>
                    There are no notes for this annotation yet
                </Box>
            )}
            {canShowTable && (
                <Box
                    component="div"
                    sx={{
                        overflow: 'hidden',
                    }}
                >
                    <Box
                        sx={{
                            '& .rowHeader': {
                                whiteSpace: 'normal',
                            },
                        }}
                        ref={hotTableRef}
                        component={HotTable}
                        settings={hotSettings}
                    />
                </Box>
            )}
            {!canShowTable && (
                <Box component="div" color="warning.dark" sx={{ margin: '1rem 0' }}>
                    There are no analyses to annotate yet. Start by{' '}
                    <Link color="primary" exact component={NavLink} to="/studies">
                        adding studies to this dataset
                    </Link>
                </Box>
            )}
        </>
    );
});

export default NeurosynthSpreadsheet;

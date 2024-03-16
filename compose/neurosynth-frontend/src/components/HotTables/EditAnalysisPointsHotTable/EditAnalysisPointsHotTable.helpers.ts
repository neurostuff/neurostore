import { HotTableProps } from '@handsontable/react';
import styles from 'components/HotTables/HotTables.module.css';
import { CellValue } from 'handsontable/common';

const nonEmptyNumericValidator = (value: CellValue, callback: (isValid: boolean) => void) => {
    const isNumber = !isNaN(value);
    if (
        isNumber &&
        value !== 'e' &&
        value !== true &&
        value !== false &&
        value !== '' // all these things are considered numbers
    ) {
        callback(true);
    } else {
        callback(false);
    }
};

export const hotTableColHeaders = ['X', 'Y', 'Z', 'Value', 'Cluster Size (mm^3)', 'Subpeak?'];
export const getHotTableColumnSettings = (disabled: boolean) => [
    {
        validator: nonEmptyNumericValidator,
        className: styles.number,
        data: 'x',
        type: 'numeric',
        readOnly: disabled,
    },
    {
        validator: nonEmptyNumericValidator,
        className: styles.number,
        data: 'y',
        type: 'numeric',
        readOnly: disabled,
    },
    {
        validator: nonEmptyNumericValidator,
        className: styles.number,
        data: 'z',
        type: 'numeric',
        readOnly: disabled,
    },
    {
        className: styles.number,
        data: 'value',
        type: 'numeric',
        readOnly: disabled,
    },
    {
        className: styles.number,
        data: 'cluster_size',
        type: 'numeric',
        readOnly: disabled,
    },
    {
        validator: (value: CellValue, callback: (isValid: boolean) => void) => {
            callback(value === true || value === false || value === undefined);
        },
        className: styles.boolean,
        data: 'subpeak',
        type: 'checkbox',
        readOnly: disabled,
    },
];

export const EditAnalysisPointsDefaultConfig: HotTableProps = {
    outsideClickDeselects: false,
    licenseKey: 'non-commercial-and-evaluation',
    selectionMode: 'range',
    allowRemoveColumn: false,
    fillHandle: {
        direction: 'vertical', // autofill horizontal doesnt follow cell validations set by columns...
        autoInsertRow: false, // when fill handle reaches the bottom of the spreadsheet, prevent more rows from being added
    },
    allowInvalid: false,
    undo: false,
    manualColumnResize: false,
    allowInsertColumn: false,
    colWidths: [50, 50, 50, 150, 150, 100],
};

export const getHotTableInsertionIndices = (selectedCoords: [number, number, number, number][]) => {
    if (selectedCoords.length === 0)
        return {
            insertAboveIndex: 0,
            insertBelowIndex: 0,
        };

    let topMostIndex = selectedCoords[0][0]; // target startRow of first selected coord
    let bottomMostIndex = selectedCoords[selectedCoords.length - 1][2]; // target endRow of last selected coord

    selectedCoords.forEach(([startRow, startCol, endRow, endCol]) => {
        if (startRow < topMostIndex) topMostIndex = startRow;
        if (endRow > bottomMostIndex) bottomMostIndex = endRow;
    });
    return {
        insertAboveIndex: topMostIndex,
        insertBelowIndex: bottomMostIndex,
    };
};

import { HotTableProps } from '@handsontable/react';
import { CellValue } from 'handsontable/common';

export const HotSettings: HotTableProps = {
    licenseKey: 'non-commercial-and-evaluation',
    undo: false,
    width: '100%',
    contextMenu: false,
    viewportRowRenderingOffset: 2,
    viewportColumnRenderingOffset: 2,
    fixedColumnsStart: 2,
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

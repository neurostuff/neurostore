import { HotTableProps } from '@handsontable/react-wrapper';
import styles from 'components/HotTables/HotTables.module.css';
import { CellValue } from 'handsontable';
import { IStorePoint } from 'stores/study/StudyStore.helpers';
import { v4 as uuid } from 'uuid';

/** Cell writes from seeding a new row. afterChange ignores this source. */
export const POINTS_SYNC_SOURCE = 'points.sync';

export const hotTableColHeaders = ['X', 'Y', 'Z', 'Value', 'Cluster Size (mm^3)', 'Subpeak?', 'Deactivations'];
export const getHotTableColumnSettings = (disabled: boolean) => [
    {
        // Built-in numeric validator. Empty is invalid so a cleared coordinate keeps the warning fill.
        allowEmpty: false,
        className: styles.number,
        data: 'x',
        type: 'numeric',
        readOnly: disabled,
    },
    {
        allowEmpty: false,
        className: styles.number,
        data: 'y',
        type: 'numeric',
        readOnly: disabled,
    },
    {
        allowEmpty: false,
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
            // Delete clears a checkbox to null. That is unchecked, not an invalid coordinate.
            callback(value === true || value === false || value === undefined || value === null);
        },
        className: styles.boolean,
        data: 'subpeak',
        type: 'checkbox',
        readOnly: disabled,
    },
    {
        className: styles.boolean,
        data: 'deactivation',
        type: 'checkbox',
        readOnly: disabled,
    },
];

export const EditStudyAnalysisCBMAPointsDefaultConfig: HotTableProps = {
    theme: 'ht-theme-classic',
    outsideClickDeselects: false,
    licenseKey: 'non-commercial-and-evaluation',
    selectionMode: 'range',
    allowRemoveColumn: false,
    fillHandle: {
        direction: 'vertical', // autofill horizontal doesnt follow cell validations set by columns...
        autoInsertRow: false, // when fill handle reaches the bottom of the spreadsheet, prevent more rows from being added
    },
    allowInvalid: true,
    undo: false,
    manualColumnResize: false,
    allowInsertColumn: false,
    colWidths: [30, 30, 30, 80, 100, 70, 70],
};

// selectedCoords: [ [ startRow, startCol, endRow, endCol ] ]
// startRow is where the drag began. endRow is the cell it finished on.
export const getHotTableInsertionIndex = (selectedCoords: number[][]) => {
    if (selectedCoords.length === 0) return 0;
    const endRow = selectedCoords[selectedCoords.length - 1][2];
    return endRow >= 0 ? endRow : 0;
};

/** Row span of the active selection. top and bottom ignore which way the drag went. */
export const getSelectionRowBounds = (selectedCoords: number[][]) => {
    if (selectedCoords.length === 0) return undefined;
    const [startRow, , endRow] = selectedCoords[selectedCoords.length - 1];
    if (typeof startRow !== 'number' || typeof endRow !== 'number' || startRow < 0 || endRow < 0) return undefined;

    const top = Math.min(startRow, endRow);
    const bottom = Math.max(startRow, endRow);
    return { top, bottom, count: bottom - top + 1 };
};

export const multiRowInsertLabel = (count: number, placement: 'above' | 'below') =>
    `Add ${count} ${count === 1 ? 'row' : 'rows'} ${placement}`;

export const pointsTableHeight = (rowCount: number) => {
    const totalHeight = 38 + rowCount * 27;
    return totalHeight > 600 ? 600 : totalHeight;
};

const emptyToUndefined = (value: unknown) => (value === '' || value === null ? undefined : value);

/** getSourceData() keeps id and isNew. '' and null become undefined so the empty-coordinate check still sees blanks. */
export const pointsFromSourceData = (sourceRows: unknown[]): IStorePoint[] =>
    sourceRows.map((sourceRow) => {
        const point = { ...((sourceRow ?? {}) as IStorePoint) };
        point.x = emptyToUndefined(point.x) as IStorePoint['x'];
        point.y = emptyToUndefined(point.y) as IStorePoint['y'];
        point.z = emptyToUndefined(point.z) as IStorePoint['z'];
        point.value = emptyToUndefined(point.value) as IStorePoint['value'];
        point.cluster_size = emptyToUndefined(point.cluster_size) as IStorePoint['cluster_size'];
        point.subpeak = emptyToUndefined(point.subpeak) as IStorePoint['subpeak'];
        point.deactivation = emptyToUndefined(point.deactivation) as IStorePoint['deactivation'];
        if (!point.id) point.id = uuid();
        if (point.isNew === undefined || point.isNew === null) point.isNew = true;
        return point;
    });

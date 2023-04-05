import { Box } from '@mui/material';
import React, { useRef, useState } from 'react';
import { HotTable } from '@handsontable/react';
import { CellChange, CellValue, ChangeSource, RangeType } from 'handsontable/common';
import { registerAllModules } from 'handsontable/registry';
import { Settings } from 'handsontable/plugins/contextMenu';
import {
    useCreateAnalysisPoints,
    useDeleteAnalysisPoints,
    useStudyAnalysisPoints,
    useUpdateAnalysisPoints,
} from 'pages/Studies/StudyStore';
import { ColumnSettings } from 'handsontable/settings';
import styles from 'components/EditAnnotations/AnnotationsHotTable/AnnotationsHotTable.module.css';
import { IStorePoint } from 'pages/Studies/StudyStore';

export const ROW_HEIGHT = 56;

registerAllModules();

// const nonEmptyNumericValidator = (value: CellValue, callback: (isValid: boolean) => void) => {
//     const isNumber = !isNaN(value);
//     if (isNumber && value !== 'e') {
//         callback(true);
//     } else {
//         callback(false);
//     }
// };

const hotTableColHeaders = ['X', 'Y', 'Z', 'Kind', 'Space'];
const hotTableColumnSettings: ColumnSettings[] = [
    {
        validator: 'numeric',
        className: styles.number,
        data: 'x',
    },
    {
        validator: 'numeric',
        className: styles.number,
        data: 'y',
    },
    {
        validator: 'numeric',
        className: styles.number,
        data: 'z',
    },
    {
        className: styles.string,
        data: 'kind',
    },
    {
        className: styles.string,
        data: 'space',
    },
];

const hotTableContextMenuSettings: Settings = [
    'row_above',
    'row_below',
    'remove_row',
    'copy',
    'cut',
];

const stripTags = (stringWhichMayHaveHTML: any) => {
    if (typeof stringWhichMayHaveHTML !== 'string') return '';

    let doc = new DOMParser().parseFromString(stringWhichMayHaveHTML, 'text/html');
    return doc.body.textContent || '';
};

const replaceString = (val: string) => {
    return val.replaceAll('−', '-');
};

const handleBeforePaste = (data: any[][], coords: RangeType[]) => {
    data.forEach((dataRow, rowIndex) => {
        dataRow.forEach((value, valueIndex) => {
            if (typeof value === 'number') return;

            const strippedData = stripTags(value); // strip all HTML tags that were copied over if they exist
            const replacedData = replaceString(strippedData); // replace minus operator with javascript character code
            const parsedData = parseInt(replacedData);
            if (!isNaN(parsedData)) {
                data[rowIndex][valueIndex] = parsedData;
            }
        });
    });

    return true;
};

/**
 * DO HANDS ON TABLE VALIDATIONS AND ADD isValid TO THE STUDYSTORE METADATA
 * on each point update, do a calculation to check if there are empty coordinate cells. If so, set invalid styling.
 * Debounce this calculation
 */

const EditAnalysisPoints: React.FC<{ analysisId?: string }> = React.memo((props) => {
    const points = useStudyAnalysisPoints(props.analysisId) as IStorePoint[];
    console.log(points);
    const updatePoints = useUpdateAnalysisPoints();
    const createPoint = useCreateAnalysisPoints();
    const deletePoints = useDeleteAnalysisPoints();
    const hotTableRef = useRef<HotTable>(null);

    const [hotTableIsValid, setHotTableIsValid] = useState(false);

    const handleAfterChange = (changes: CellChange[] | null, source: ChangeSource) => {
        if (!props.analysisId) return;
        if (!changes) return;

        const updatedPoints = [...points];
        changes.forEach((change) => {
            if (!change) return;
            const [index, colName, prev, next] = change;
            const nextVal = next === null ? undefined : next;
            updatedPoints[index] = {
                ...updatedPoints[index],
                [colName]: nextVal,
            };
        });

        updatePoints(props.analysisId, updatedPoints);

        // if the index is greater than the array size, new elements will be added into the array.
        // we use this to our advantage to determine if rows were copy pasted
        if (source === 'CopyPaste.paste' && updatedPoints.length > points.length) {
            const pointsToCreate = updatedPoints.slice(points.length, updatedPoints.length);
            createPoint(props.analysisId, pointsToCreate, points.length);
        }

        return;
    };

    const handleBeforeRemoveRow = (
        index: number,
        amount: number,
        physicalColumns: number[],
        source?: ChangeSource | undefined
    ) => {
        if (!props.analysisId) return false;
        if (points.length <= 1) return false;

        const idsRemoved = physicalColumns.map((index) => points[index].id || '');
        deletePoints(props.analysisId, idsRemoved);
        return false;
    };

    const handleAfterValidate = (
        isValid: boolean,
        value: any,
        row: number,
        prop: string | number,
        source: ChangeSource
    ) => {
        console.log({
            isValid,
            value,
            row,
            prop,
            source,
        });
    };

    const handleBeforeCreateRow = (
        index: number,
        amount: number,
        source?: ChangeSource | undefined
    ) => {
        if (!props.analysisId) return false;

        if (source === 'ContextMenu.rowAbove' || source === 'ContextMenu.rowBelow') {
            const addedRowIndex = source === 'ContextMenu.rowAbove' ? index - 1 : index + 1;
            createPoint(
                props.analysisId,
                [
                    {
                        x: undefined,
                        y: undefined,
                        z: undefined,
                        kind: '',
                        space: '',
                        isNew: true,
                    },
                ],
                addedRowIndex
            );
        }
        return false;
    };

    return (
        <Box>
            <HotTable
                ref={hotTableRef}
                licenseKey="non-commercial-and-evaluation"
                afterChange={handleAfterChange}
                beforePaste={handleBeforePaste}
                beforeRemoveRow={handleBeforeRemoveRow}
                beforeCreateRow={handleBeforeCreateRow}
                afterValidate={handleAfterValidate}
                stretchH="all"
                allowRemoveColumn={false}
                allowInvalid={false}
                height="auto"
                undo={false}
                colWidths={[100, 100, 100, 200, 200]}
                manualColumnResize
                allowInsertColumn={false}
                columns={hotTableColumnSettings}
                contextMenu={hotTableContextMenuSettings}
                colHeaders={hotTableColHeaders}
                data={points}
            />
        </Box>
    );
});

export default EditAnalysisPoints;

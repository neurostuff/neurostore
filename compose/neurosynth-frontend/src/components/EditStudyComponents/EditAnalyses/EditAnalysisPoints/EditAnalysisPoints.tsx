import { Box, Button, Link, Typography } from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import { HotTable } from '@handsontable/react';
import { CellChange, CellValue, ChangeSource, RangeType } from 'handsontable/common';
import { registerAllModules } from 'handsontable/registry';
import { Settings } from 'handsontable/plugins/contextMenu';
import {
    useCreateAnalysisPoints,
    useDeleteAnalysisPoints,
    useSetIsValid,
    useStudyAnalysisPoints,
    useUpdateAnalysisPoints,
} from 'pages/Studies/StudyStore';
import { ColumnSettings } from 'handsontable/settings';
import styles from 'components/EditAnnotations/AnnotationsHotTable/AnnotationsHotTable.module.css';
import { IStorePoint } from 'pages/Studies/StudyStore';

export const ROW_HEIGHT = 56;

registerAllModules();

const nonEmptyNumericValidator = (value: CellValue, callback: (isValid: boolean) => void) => {
    const isNumber = !isNaN(value);
    if (isNumber && value !== 'e') {
        callback(true);
    } else {
        callback(false);
    }
};

const hotTableColHeaders = ['X', 'Y', 'Z', 'Statistic', 'Space'];
const hotTableColumnSettings: ColumnSettings[] = [
    {
        validator: nonEmptyNumericValidator,
        className: styles.number,
        data: 'x',
    },
    {
        validator: nonEmptyNumericValidator,
        className: styles.number,
        data: 'y',
    },
    {
        validator: nonEmptyNumericValidator,
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
    // replace = ['֊', '‐', '‑', '⁃', '﹣', '－', '‒', '–', '—', '﹘', '−', '-']

    return val.replaceAll(new RegExp('֊|‐|‑|⁃|﹣|－|‒|–|—|﹘|−|-', 'g'), '-');
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

const parseNumericString = (val: string | undefined): string | number | undefined => {
    let newVal: string | number | undefined = val;
    if (newVal === null || newVal === '') {
        newVal = undefined;
    } else if (typeof newVal === 'string') {
        const parsedVal = parseInt(newVal);
        newVal = isNaN(parsedVal) ? newVal : parsedVal;
    }
    return newVal;
};

const EditAnalysisPoints: React.FC<{ analysisId?: string }> = React.memo((props) => {
    const points = useStudyAnalysisPoints(props.analysisId) as IStorePoint[] | null;
    const updatePoints = useUpdateAnalysisPoints();
    const createPoint = useCreateAnalysisPoints();
    const deletePoints = useDeleteAnalysisPoints();
    const setIsValid = useSetIsValid();
    const hotTableRef = useRef<HotTable>(null);

    useEffect(() => {
        const hotData = hotTableRef.current?.hotInstance?.getData();
        const hasEmptyCoordinates = (hotData || []).some(
            ([x, y, z, _kind, _space]) => x === undefined || y === undefined || z === undefined
        );
        setIsValid(!hasEmptyCoordinates);
        hotTableRef.current?.hotInstance?.validateCells();
    }, [points, setIsValid]);

    const handleAfterChange = (changes: CellChange[] | null, source: ChangeSource) => {
        if (!props.analysisId) return;
        if (!changes) return;
        if (!points) return;

        const updatedPoints = [...points];
        changes.forEach((change) => {
            if (!change) return;
            const [index, colName, prev, next] = change;
            const nextVal = parseNumericString(next);
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
        if (!points || points.length <= 1) return false;

        const idsRemoved = physicalColumns.map((index) => points[index].id || '');
        deletePoints(props.analysisId, idsRemoved);
        return false;
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
                        kind: undefined,
                        space: undefined,
                        isNew: true,
                    },
                ],
                addedRowIndex
            );
        }
        return false;
    };

    const totalHeight = 28 + (points?.length || 0) * 23;
    const height = totalHeight > 500 ? 500 : totalHeight;

    return (
        <Box sx={{ width: '100%' }}>
            <HotTable
                ref={hotTableRef}
                licenseKey="non-commercial-and-evaluation"
                afterChange={handleAfterChange}
                beforePaste={handleBeforePaste}
                beforeRemoveRow={handleBeforeRemoveRow}
                beforeCreateRow={handleBeforeCreateRow}
                allowRemoveColumn={false}
                allowInvalid={false}
                undo={false}
                colWidths={[50, 50, 50, 150, 150]}
                manualColumnResize
                height={height}
                allowInsertColumn={false}
                columns={hotTableColumnSettings}
                contextMenu={hotTableContextMenuSettings}
                colHeaders={hotTableColHeaders}
                data={points || []}
            />
            {(!points || points.length === 0) && (
                <Typography sx={{ color: 'warning.dark', marginTop: '0.5rem' }}>
                    No coordinate data.{' '}
                    <Link
                        onClick={() => {
                            if (!props.analysisId) return;
                            createPoint(
                                props.analysisId,
                                [
                                    {
                                        x: undefined,
                                        y: undefined,
                                        z: undefined,
                                        kind: undefined,
                                        space: undefined,
                                        isNew: true,
                                    },
                                ],
                                0
                            );
                        }}
                        underline="hover"
                        sx={{ cursor: 'pointer' }}
                    >
                        Click here to get started
                    </Link>
                </Typography>
            )}
        </Box>
    );
});

export default EditAnalysisPoints;

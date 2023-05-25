import { HotTable } from '@handsontable/react';
import { Box, Link, Typography } from '@mui/material';
import InputNumberDialog from 'components/Dialogs/InputNumberDialog/InputNumberDialog';
import styles from 'components/EditAnnotations/AnnotationsHotTable/AnnotationsHotTable.module.css';
import { CellChange, CellValue, ChangeSource, RangeType } from 'handsontable/common';
import { registerAllModules } from 'handsontable/registry';
import { ColumnSettings } from 'handsontable/settings';
import {
    IStorePoint,
    useCreateAnalysisPoints,
    useDeleteAnalysisPoints,
    useSetIsValid,
    useStudyAnalysisPoints,
    useUpdateAnalysisPoints,
} from 'pages/Studies/StudyStore';
import React, { useEffect, useRef, useState } from 'react';

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
        type: 'numeric',
    },
    {
        validator: nonEmptyNumericValidator,
        className: styles.number,
        data: 'y',
        type: 'numeric',
    },
    {
        validator: nonEmptyNumericValidator,
        className: styles.number,
        data: 'z',
        type: 'numeric',
    },
    {
        className: styles.string,
        data: 'kind',
        type: 'text',
    },
    {
        className: styles.string,
        data: 'space',
        type: 'text',
    },
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

const getHotTableInsertionIndices = (selectedCoords: [number, number, number, number][]) => {
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

const EditAnalysisPoints: React.FC<{ analysisId?: string }> = React.memo((props) => {
    const points = useStudyAnalysisPoints(props.analysisId) as IStorePoint[] | null;
    const updatePoints = useUpdateAnalysisPoints();
    const createPoint = useCreateAnalysisPoints();
    const deletePoints = useDeleteAnalysisPoints();
    const setIsValid = useSetIsValid();
    const hotTableRef = useRef<HotTable>(null);
    const hotTableMetadata = useRef<{ insertRowsAbove: boolean; insertedRowsViaPaste: any[][] }>({
        insertRowsAbove: true,
        insertedRowsViaPaste: [],
    });
    const [insertRowsDialogIsOpen, setInsertRowsDialogIsOpen] = useState(false);

    useEffect(() => {
        const hotData = hotTableRef.current?.hotInstance?.getData();
        const hasEmptyCoordinates = (hotData || []).some(
            ([x, y, z, _kind, _space]) => x === undefined || y === undefined || z === undefined
        );
        setIsValid(!hasEmptyCoordinates);
        hotTableRef.current?.hotInstance?.validateCells();
    }, [points, setIsValid]);

    useEffect(() => {
        if (hotTableRef.current?.hotInstance) {
            hotTableRef.current.hotInstance.updateSettings({
                contextMenu: {
                    items: {
                        row_above: {
                            name: 'Add rows above',
                            callback: (key, options) => {
                                hotTableMetadata.current.insertRowsAbove = true;
                                setInsertRowsDialogIsOpen(true);
                            },
                        },
                        row_below: {
                            name: 'Add rows below',
                            callback: (key, options) => {
                                hotTableMetadata.current.insertRowsAbove = false;
                                setInsertRowsDialogIsOpen(true);
                            },
                        },
                        remove_row: {
                            name: 'Remove row(s)',
                        },
                        copy: {
                            name: 'Copy',
                        },
                        cut: {
                            name: 'Cut',
                        },
                    },
                },
            });
        }
    }, [hotTableRef]);

    // handsontable binds and updates to the data references themselves which means the original data is being mutated.
    // as we use zustand, this may not be a good idea, so we implement handleAfterChange to
    //      (1) make a request to zustand in order to make sure it is aware of the update that occurred,
    //      (2) replace handsontable's data update with our own, and
    //      (3) utilize handsontable's native validation (which does not get fired if we use beforeChange)
    const handleAfterChange = (changes: CellChange[] | null, source: ChangeSource) => {
        if (!props.analysisId) return;
        if (!changes) return;
        if (!points) return;

        const updatedPoints = [...points];
        changes.forEach((change) => {
            if (!change) return;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const [index, colName, _prev, next] = change;
            updatedPoints[index] = {
                ...updatedPoints[index],
                [colName]: next,
            };
        });

        updatePoints(props.analysisId, updatedPoints);
    };

    const handleBeforePaste = (data: any[][], coords: RangeType[]) => {
        if (!points) return false;

        data.forEach((dataRow, rowIndex) => {
            dataRow.forEach((value, valueIndex) => {
                if (typeof value === 'number') return;
                const strippedData = stripTags(value); // strip all HTML tags that were copied over if they exist
                const replacedData = replaceString(strippedData); // replace minus operator with javascript character code

                data[rowIndex][valueIndex] = replacedData;
            });
        });

        let endRowIndex = 0;
        coords.forEach(({ startCol, startRow, endCol, endRow }) => {
            if (endRow > endRowIndex) endRowIndex = endRow;
        });

        if (endRowIndex + data.length > points.length) {
            const rowsToCreate: any[][] = [];
            for (let i = points.length - endRowIndex; i < data.length; i++) {
                rowsToCreate.push(data[i]);
            }

            hotTableMetadata.current.insertedRowsViaPaste = rowsToCreate;
        } else {
            hotTableMetadata.current.insertedRowsViaPaste = [];
        }

        return true;
    };

    const handleBeforeCreateRow = (
        index: number,
        amount: number,
        source?: ChangeSource | undefined
    ) => {
        if (props.analysisId && source === 'CopyPaste.paste') {
            const analysisId = props.analysisId;
            createPoint(
                analysisId,
                hotTableMetadata.current.insertedRowsViaPaste.map((row) => ({
                    x: undefined,
                    y: undefined,
                    z: undefined,
                    kind: undefined,
                    space: undefined,
                    isNew: true,
                })),
                index
            );
        }
        return false;
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

    const handleInsertRows = (numRows: number) => {
        if (hotTableRef.current?.hotInstance && props.analysisId) {
            const selectedCoords = hotTableRef.current.hotInstance.getSelected();
            if (!selectedCoords) return;

            const { insertAboveIndex, insertBelowIndex } =
                getHotTableInsertionIndices(selectedCoords);
            createPoint(
                props.analysisId,
                [...Array(numRows).keys()].map((num) => ({
                    x: undefined,
                    y: undefined,
                    z: undefined,
                    kind: undefined,
                    space: undefined,
                    isNew: true,
                })),
                hotTableMetadata.current.insertRowsAbove ? insertAboveIndex : insertBelowIndex + 1
            );
            setInsertRowsDialogIsOpen(false);
        }
    };

    const totalHeight = 28 + (points?.length || 0) * 23;
    const height = totalHeight > 500 ? 500 : totalHeight;

    return (
        <Box sx={{ width: '100%' }}>
            <InputNumberDialog
                isOpen={insertRowsDialogIsOpen}
                dialogTitle="Enter number of rows to insert"
                onCloseDialog={() => setInsertRowsDialogIsOpen(false)}
                onInputNumber={(val) => handleInsertRows(val)}
                dialogDescription=""
            />
            <HotTable
                ref={hotTableRef}
                outsideClickDeselects={false}
                licenseKey="non-commercial-and-evaluation"
                afterChange={handleAfterChange} // beforeChange results in weird update issues so we use afterChange
                beforePaste={handleBeforePaste}
                beforeCreateRow={handleBeforeCreateRow}
                beforeRemoveRow={handleBeforeRemoveRow}
                allowRemoveColumn={false}
                allowInvalid={false}
                undo={false}
                colWidths={[50, 50, 50, 150, 150]}
                manualColumnResize
                height={height}
                allowInsertColumn={false}
                columns={hotTableColumnSettings}
                colHeaders={hotTableColHeaders}
                data={[...(points || [])]}
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

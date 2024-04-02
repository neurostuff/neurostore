import { HotTable } from '@handsontable/react';
import Add from '@mui/icons-material/Add';
import { Box, Button, Link, Typography } from '@mui/material';
import InputNumberDialog from 'components/Dialogs/InputNumberDialog/InputNumberDialog';
import { CellRange } from 'handsontable';
import { CellChange, ChangeSource, RangeType } from 'handsontable/common';
import { registerAllModules } from 'handsontable/registry';
import {
    useCreateAnalysisPoints,
    useDeleteAnalysisPoints,
    useStudyAnalysisPoints,
    useUpdateAnalysisPoints,
} from 'pages/Studies/StudyStore';
import { IStorePoint } from 'pages/Studies/StudyStore.helpers';
import React, { useMemo, useRef } from 'react';
import { sanitizePaste } from '../HotTables.utils';
import {
    EditAnalysisPointsDefaultConfig,
    getHotTableInsertionIndices,
    hotTableColHeaders,
    getHotTableColumnSettings,
} from './EditAnalysisPointsHotTable.helpers';
import useEditAnalysisPointsHotTable from './useEditAnalysisPointsHotTable';

registerAllModules();

const EditAnalysisPointsHotTable: React.FC<{ analysisId?: string; disabled: boolean }> = React.memo(
    (props) => {
        const points = useStudyAnalysisPoints(props.analysisId) as IStorePoint[] | null;
        const updatePoints = useUpdateAnalysisPoints();
        const createPoint = useCreateAnalysisPoints();
        const deletePoints = useDeleteAnalysisPoints();
        const hotTableRef = useRef<HotTable>(null);
        const hotTableMetadata = useRef<{
            insertRowsAbove: boolean;
            insertedRowsViaPaste: any[][];
        }>({
            insertRowsAbove: true,
            insertedRowsViaPaste: [],
        });
        const { height, insertRowsDialogIsOpen, closeInsertRowsDialog } =
            useEditAnalysisPointsHotTable(props.analysisId, hotTableRef, hotTableMetadata);

        // handsontable binds and updates to the data references themselves which means the original data is being mutated.
        // as we use zustand, this may not be a good idea, so we implement handleAfterChange to
        //      (1) make a request to zustand in order to make sure it is aware of the update that occurred,
        //      (2) replace handsontable's data update with our own,
        //      (3) utilize handsontable's native validation (which does not get fired if we use beforeChange)
        //      (4) replace null or '' values with undefined as hot treats '' and null as valid (isNaN(null) === false)
        const handleAfterChange = (changes: CellChange[] | null, source: ChangeSource) => {
            if (!props.analysisId) return;
            if (!changes) return;
            if (!points) return;

            const updatedPoints = [...points];
            changes.forEach((change) => {
                if (!change) return;
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const [index, colName, _prev, next] = change;
                let newVal = next;
                if (newVal === null || newVal === '') {
                    newVal = undefined;
                }
                updatedPoints[index] = {
                    ...updatedPoints[index],
                    [colName]: newVal,
                };
            });
            updatePoints(props.analysisId, updatedPoints);
        };

        // for all pasted data, remove any copied HTML tags and replace minus sign lookalikes with the expected minus sign.
        // HTML tags can be added when copying from HTML tables and all sorts of non standard minus signs are used to represent negative number.
        const handleBeforePaste = (data: any[][], coords: RangeType[]) => {
            if (!points) return false;

            sanitizePaste(data);

            // if a paste leads to rows being created, we store those rows in a ref for the handleBeforeCreateRow hook to
            // know how many rows to create
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

        // this hook is fired on paste when a paste causes new rows to be created. We get the ref and retrieve the number of new rows to create.
        // Normally, handsontable is in charge of creating new rows but we return false here to prevent that.
        // Instead, we create the rows and update the data source ourselves.

        // Note: after this hook is fired, the copy pasted cell data is set in the data rows that we create.
        // This is somewhat problematic as it modifies the zustand store object directly instead of calling set, which is exactly why we've been returning false everywhere.
        // However, there doesn't seem to be any issue with this because a proper zustand update still occurs when a new row
        // is created (via createPoint), and handleAfterChange is then called which creates another proper zustand update (updatePoints)
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
                        subpeak: undefined,
                        value: undefined,
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

        // vertical autofill of an empty cell into other empty cells allows it to work and breaks validation...so whenever
        // we autofill we need to validate again
        const handleAfterAutofill = (
            fillData: any[][],
            sourceRange: CellRange,
            targetRange: CellRange,
            direction: 'right' | 'left' | 'up' | 'down'
        ): void => {
            if (!hotTableRef?.current?.hotInstance) return;
            hotTableRef.current?.hotInstance?.validateCells();
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
                        value: undefined,
                        isNew: true,
                    })),
                    hotTableMetadata.current.insertRowsAbove
                        ? insertAboveIndex
                        : insertBelowIndex + 1
                );
                closeInsertRowsDialog();
            }
        };

        const hotTableColumnSettings = useMemo(() => {
            return getHotTableColumnSettings(props.disabled);
        }, [props.disabled]);

        /**
         * Hook Order:
         * 1) handleBeforePaste
         * 2) handleBeforeChange // we don't want to handle data in this hook as returning false here prevents cell validations from running
         * 3) handleAfterPaste
         * 4) handleBeforeCreateRow
         * 5) handleAfterChange
         */
        return (
            <Box sx={{ width: '100%' }}>
                <InputNumberDialog
                    isOpen={insertRowsDialogIsOpen}
                    dialogTitle="Enter number of rows to insert"
                    onCloseDialog={() => closeInsertRowsDialog()}
                    onInputNumber={(val) => handleInsertRows(val)}
                    dialogDescription=""
                />
                <HotTable
                    {...EditAnalysisPointsDefaultConfig}
                    ref={hotTableRef}
                    afterChange={handleAfterChange} // beforeChange results in weird update issues so we use afterChange
                    beforePaste={handleBeforePaste}
                    beforeCreateRow={handleBeforeCreateRow}
                    beforeRemoveRow={handleBeforeRemoveRow}
                    afterAutofill={handleAfterAutofill}
                    height={height}
                    columns={hotTableColumnSettings}
                    colHeaders={hotTableColHeaders}
                    data={[...(points || [])]}
                />
                {(points?.length || 0) === 0 && !props.disabled ? (
                    <Typography sx={{ color: 'warning.dark', marginTop: '0.5rem' }}>
                        No coordinate data.{' '}
                        <Link
                            onClick={() => {
                                if (!props.analysisId) return;
                                createPoint(
                                    props.analysisId,
                                    [
                                        {
                                            value: undefined,
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
                ) : (
                    <Button
                        endIcon={<Add />}
                        disabled={props.disabled}
                        onClick={() => {
                            if (!props.analysisId) return;
                            createPoint(
                                props.analysisId,
                                [
                                    {
                                        value: undefined,
                                        isNew: true,
                                    },
                                ],
                                points?.length || 0
                            );
                        }}
                    >
                        Add Row
                    </Button>
                )}
            </Box>
        );
    }
);

export default EditAnalysisPointsHotTable;

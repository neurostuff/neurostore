import { HotTableRef } from '@handsontable/react-wrapper';
import { Box } from '@mui/material';
import { EditAnalysisPointsHotSnapshot } from 'pages/StudyCBMA/hooks/useEditAnalysisPointsHotTable';
import { useStudyCBMAContext } from 'pages/StudyCBMA/context/StudyCBMAContext';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMarkStudyEdited, useReplaceAnalysisPoints } from 'stores/study/StudyStore';
import InputNumberDialog from 'pages/StudyCBMA/components/EditStudyAnalysisCBMAInputNumberDialog';
import { getHotTableInsertionIndex, pointsFromSourceData } from './EditStudyAnalysisCBMAPointsHotTable.helpers';
import EditStudyAnalysisCBMAPointsHotTableToolbar from './EditStudyAnalysisCBMAPointsHotTableToolbar';
import EditStudyAnalysisCBMAPointsHotTable from './EditStudyAnalysisCBMAPointsHotTable';

const EditStudyAnalysisCBMAPointsTableContainer = ({
    analysisId,
    snapshot,
    readOnly = false,
    onAllPointsHaveCoordinates,
}: {
    analysisId?: string;
    snapshot?: EditAnalysisPointsHotSnapshot;
    readOnly?: boolean;
    onAllPointsHaveCoordinates: (pointsHaveCoordinates: boolean) => void;
}) => {
    const hotTableRef = useRef<HotTableRef | null>(null);
    const analysisIdRef = useRef(analysisId);
    analysisIdRef.current = snapshot?.analysisId ?? analysisId;
    const { pointsTableRef } = useStudyCBMAContext();
    const markStudyEdited = useMarkStudyEdited();
    const replaceAnalysisPoints = useReplaceAnalysisPoints();
    const [insertRowsDialogIsOpen, setInsertRowsDialogIsOpen] = useState(false);

    useEffect(() => {
        pointsTableRef.current = {
            flushPoints: () => {
                const currentAnalysisId = analysisIdRef.current;
                const hot = hotTableRef.current?.hotInstance;
                if (!currentAnalysisId || !hot) return;
                replaceAnalysisPoints(currentAnalysisId, pointsFromSourceData(hot.getSourceData()));
            },
        };
        return () => {
            pointsTableRef.current = null;
        };
    }, [pointsTableRef, replaceAnalysisPoints]);

    const openInsertRowsDialog = useCallback(() => {
        setInsertRowsDialogIsOpen(true);
    }, []);

    const closeInsertRowsDialog = useCallback(() => {
        setInsertRowsDialogIsOpen(false);
    }, []);

    const handleInsertRows = (numRows: number) => {
        const hot = hotTableRef.current?.hotInstance;
        if (!hot) return;

        const lastRow = Math.max(hot.countRows() - 1, 0);
        const selected = hot.getSelected() ?? [[lastRow, 0, lastRow, 2]];
        const insertionIndex = getHotTableInsertionIndex(selected);
        hot.alter('insert_row_below', insertionIndex, numRows);
        closeInsertRowsDialog();
    };

    const handleAddRow = () => {
        const hot = hotTableRef.current?.hotInstance;
        if (!hot) return;
        // insertionIndex, amount
        hot.alter('insert_row_below', Math.max(hot.countRows() - 1, 0), 1);
    };

    const handleDeleteRows = () => {
        const hot = hotTableRef.current?.hotInstance;
        if (!hot) return;
        const selected = hot.getSelected();
        if (!selected || selected.length !== 1) return;

        const [startRow, , endRow] = selected[0];
        const from = Math.min(startRow, endRow);
        const to = Math.max(startRow, endRow);
        hot.alter('remove_row', from, to - from + 1);
    };

    return (
        <Box>
            <InputNumberDialog
                isOpen={insertRowsDialogIsOpen}
                dialogTitle="Enter number of rows to insert"
                onCloseDialog={closeInsertRowsDialog}
                onSubmit={handleInsertRows}
                dialogDescription=""
            />
            <Box sx={{ display: 'flex' }}>
                <Box
                    sx={{
                        width: '40px',
                        height: '120px',
                        marginRight: '0.5rem',
                    }}
                >
                    <EditStudyAnalysisCBMAPointsHotTableToolbar
                        onAddRow={handleAddRow}
                        onAddRows={openInsertRowsDialog}
                        onDeleteRows={handleDeleteRows}
                    />
                </Box>
                <Box sx={{ width: '100%' }}>
                    {snapshot && (
                        <EditStudyAnalysisCBMAPointsHotTable
                            key={`${snapshot.analysisId}-${snapshot.seed}`}
                            snapshot={snapshot}
                            hotTableRef={hotTableRef}
                            onStudyEdited={markStudyEdited}
                            onAllPointsHaveCoordinates={onAllPointsHaveCoordinates}
                            readOnly={readOnly}
                        />
                    )}
                </Box>
            </Box>
        </Box>
    );
};

export default EditStudyAnalysisCBMAPointsTableContainer;

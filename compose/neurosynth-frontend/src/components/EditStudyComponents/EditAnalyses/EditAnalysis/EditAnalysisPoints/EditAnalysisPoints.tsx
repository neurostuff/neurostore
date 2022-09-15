import { Box } from '@mui/material';
import {
    DataGrid,
    GridColumns,
    GridCellEditCommitParams,
    MuiEvent,
    MuiBaseEvent,
    GridCallbackDetails,
} from '@mui/x-data-grid';
import React, { useCallback } from 'react';
import { useIsFetching } from 'react-query';
import { IEditAnalysisPoints } from '../..';
import { useCreatePoint, useDeletePoint, useUpdatePoint, useUpdateAnalysis } from 'hooks';
import AnalysisPointsHeader from './AnalysisPointsHeader';
import AnalysisPointsDeleteButton from './AnalysisPointsDeleteButton';

export const ROW_HEIGHT = 56;

const EditAnalysisPoints: React.FC<IEditAnalysisPoints> = (props) => {
    const { isLoading: createPointIsLoading, mutate: createPoint } = useCreatePoint();
    const { isLoading: updatePointIsLoading, mutate: updatePoint } = useUpdatePoint();
    const { isLoading: deletePointIsLoading, mutate: deletePoint } = useDeletePoint();
    const { isLoading: updateAnalysisIsLoading, mutate: updateAnalysis } = useUpdateAnalysis();
    const isFetching = useIsFetching(['studies', props.studyId]);

    const handleOnDelete = useCallback(
        (pointId: string) => {
            deletePoint(pointId);
        },
        [deletePoint]
    );

    const tableColumns: GridColumns = [
        {
            field: 'x',
            headerAlign: 'left',
            align: 'left',
            headerName: 'X Coordinate',
            editable: true,
            flex: 1,
            type: 'number',
        },
        {
            field: 'y',
            headerAlign: 'left',
            align: 'left',
            headerName: 'Y Coordinate',
            editable: true,
            flex: 1,
            type: 'number',
        },
        {
            field: 'z',
            headerAlign: 'left',
            align: 'left',
            headerName: 'Z Coordinate',
            editable: true,
            flex: 1,
            type: 'number',
        },
        {
            field: 'kind',
            headerName: 'kind',
            editable: true,
            flex: 1.5,
            type: 'string',
            align: 'left',
            headerAlign: 'left',
        },
        {
            field: 'space',
            headerName: 'space',
            editable: true,
            flex: 1.5,
            type: 'string',
            align: 'left',
            headerAlign: 'left',
        },
        {
            field: 'delete',
            headerName: 'Actions',
            headerAlign: 'left',
            align: 'left',
            editable: false,
            width: 90,
            renderCell: (params) => (
                <AnalysisPointsDeleteButton
                    pointId={params.id as string}
                    onDelete={handleOnDelete}
                />
            ),
        },
    ];

    const handleCellEditCommit = (
        params: GridCellEditCommitParams,
        _event: MuiEvent<MuiBaseEvent>,
        _details: GridCallbackDetails
    ) => {
        updatePoint({
            pointId: params.id as string,
            point: {
                [params.field]: params.value,
            },
        });
    };

    const handleCreatePoint = () => {
        createPoint(props.analysisId || '');
    };

    const handleMovePoints = (pointsToAnalysisId: string, pointIdsToMove: string[]) => {
        updateAnalysis({
            analysisId: pointsToAnalysisId,
            analysis: {
                points: pointIdsToMove,
            },
        });
    };

    const rows = (props.points || [])
        .sort((a, b) => {
            const dateA = Date.parse(a.created_at || '');
            const dateB = Date.parse(b.created_at || '');
            if (isNaN(dateA) || isNaN(dateB)) {
                return 0;
            }

            return dateB - dateA;
        })
        .map((point, index) => ({
            id: point.id || index,
            x: (point?.coordinates || [])[0] || 0,
            y: (point?.coordinates || [])[1] || 0,
            z: (point?.coordinates || [])[2] || 0,
            kind: point.kind,
            space: point.space,
        }));

    // 70 is the height of the AnalysisPointsHeader and its border
    // 1 is for the bottom border of the head row
    // add one to account for column header
    // add one to account for the "no rows message"
    const totalTableHeight = 71 + 1 + (rows.length + 1 + (rows.length === 0 ? 1 : 0)) * ROW_HEIGHT;

    return (
        <Box
            className="test-test-test"
            sx={{ height: totalTableHeight < 600 ? `${totalTableHeight}px` : '600px' }}
        >
            <DataGrid
                loading={
                    createPointIsLoading ||
                    deletePointIsLoading ||
                    updatePointIsLoading ||
                    updateAnalysisIsLoading ||
                    isFetching > 0
                }
                showCellRightBorder
                onCellEditCommit={handleCellEditCommit}
                disableSelectionOnClick
                hideFooter
                rowHeight={ROW_HEIGHT}
                checkboxSelection
                components={{
                    Toolbar: AnalysisPointsHeader,
                }}
                componentsProps={{
                    toolbar: {
                        studyId: props.studyId,
                        analysisId: props.analysisId,
                        onCreatePoint: handleCreatePoint,
                        onMovePoints: handleMovePoints,
                    },
                }}
                rows={rows}
                columns={tableColumns}
            />
        </Box>
    );
};

export default EditAnalysisPoints;

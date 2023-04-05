import { Box } from '@mui/material';
import React, { useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { CellChange, ChangeSource, RangeType } from 'handsontable/common';
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

const hotTableColHeaders = ['X', 'Y', 'Z', 'Kind', 'Space'];
const hotTableColumnSettings: ColumnSettings[] = [
    {
        validator: 'numeric',
        className: styles.number,
        data: 'coordinates.0',
    },
    {
        validator: 'numeric',
        className: styles.number,
        data: 'coordinates.1',
    },
    {
        validator: 'numeric',
        className: styles.number,
        data: 'coordinates.2',
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

const EditAnalysisPoints: React.FC<{ analysisId?: string }> = React.memo((props) => {
    console.log('render');
    const points = useStudyAnalysisPoints(props.analysisId) as IStorePoint[];
    const updatePoints = useUpdateAnalysisPoints();
    const createPoint = useCreateAnalysisPoints();
    const deletePoints = useDeleteAnalysisPoints();
    const hotTableRef = useRef<HotTable>(null);

    // make a copy so that hot table doesnt update the original
    const hotPoints = points.map((x) => ({ ...x }));

    const handlebeforeChange = (changes: (CellChange | null)[], source: ChangeSource) => {
        if (!props.analysisId) return;
        if (changes.length === 0) return;
        console.log(changes);
        // updatePoints(props.analysisId, )
        return false;
    };

    console.log(points);

    const handleBeforeRemoveRow = (
        index: number,
        amount: number,
        physicalColumns: number[],
        source?: ChangeSource | undefined
    ) => {
        console.log({
            rowEdit: 'REMOVE',
            index,
            amount,
            physicalColumns,
            source,
        });

        return false;
    };

    const handleBeforeCreateRow = (
        index: number,
        amount: number,
        source?: ChangeSource | undefined
    ) => {
        if (!props.analysisId) return false;

        if (source === 'auto' && points.length === 0) {
            return true;
        }

        if (source === 'ContextMenu.rowAbove') {
            createPoint(
                props.analysisId,
                [
                    {
                        coordinates: [0, 0, 0],
                        kind: '',
                        space: '',
                        isNew: true,
                    },
                ],
                index === 0 ? index : index - 1
            );
        } else if (source === 'ContextMenu.rowBelow') {
            createPoint(
                props.analysisId,
                [
                    {
                        coordinates: [0, 0, 0],
                        kind: '',
                        space: '',
                        isNew: true,
                    },
                ],
                index + 1
            );
        }

        return false;
    };

    return (
        <Box>
            <HotTable
                ref={hotTableRef}
                licenseKey="non-commercial-and-evaluation"
                beforeChange={handlebeforeChange}
                beforePaste={handleBeforePaste}
                beforeRemoveRow={handleBeforeRemoveRow}
                beforeCreateRow={handleBeforeCreateRow}
                allowRemoveColumn={false}
                allowInvalid={false}
                minRows={1}
                height="auto"
                colWidths={[100, 100, 100, 200, 200]}
                manualColumnResize
                allowInsertColumn={false}
                columns={hotTableColumnSettings}
                contextMenu={hotTableContextMenuSettings}
                colHeaders={hotTableColHeaders}
                data={hotPoints}
            />
        </Box>
    );
});

export default EditAnalysisPoints;
//     const { isLoading: createPointIsLoading, mutate: createPoint } = useCreatePoint();
//     const { isLoading: updatePointIsLoading, mutate: updatePoint } = useUpdatePoint();
//     const { isLoading: deletePointIsLoading, mutate: deletePoint } = useDeletePoint();
//     const { isLoading: updateAnalysisIsLoading, mutate: updateAnalysis } = useUpdateAnalysis();
//     const isFetching = useIsFetching(['studies', props.studyId]);

//     const handleOnDelete = useCallback(
//         (pointId: string) => {
//             deletePoint(pointId);
//         },
//         [deletePoint]
//     );

//     const tableColumns: GridColumns = [
//         {
//             field: 'x',
//             headerAlign: 'left',
//             align: 'left',
//             headerName: 'X Coordinate',
//             editable: true,
//             flex: 1,
//             type: 'number',
//         },
//         {
//             field: 'y',
//             headerAlign: 'left',
//             align: 'left',
//             headerName: 'Y Coordinate',
//             editable: true,
//             flex: 1,
//             type: 'number',
//         },
//         {
//             field: 'z',
//             headerAlign: 'left',
//             align: 'left',
//             headerName: 'Z Coordinate',
//             editable: true,
//             flex: 1,
//             type: 'number',
//         },
//         {
//             field: 'kind',
//             headerName: 'kind',
//             editable: true,
//             flex: 1.5,
//             type: 'string',
//             align: 'left',
//             headerAlign: 'left',
//         },
//         {
//             field: 'space',
//             headerName: 'space',
//             editable: true,
//             flex: 1.5,
//             type: 'string',
//             align: 'left',
//             headerAlign: 'left',
//         },
//         {
//             field: 'delete',
//             headerName: 'Actions',
//             headerAlign: 'left',
//             align: 'left',
//             editable: false,
//             width: 90,
//             renderCell: (params) => (
//                 <AnalysisPointsDeleteButton
//                     pointId={params.id as string}
//                     onDelete={handleOnDelete}
//                 />
//             ),
//         },
//     ];

//     const handleCellEditCommit = (
//         params: GridCellEditCommitParams,
//         _event: MuiEvent<MuiBaseEvent>,
//         _details: GridCallbackDetails
//     ) => {
//         updatePoint({
//             pointId: params.id as string,
//             point: {
//                 [params.field]: params.value,
//             },
//         });
//     };

//     const handleCreatePoint = () => {
//         createPoint(props.analysisId || '');
//     };

//     const handleMovePoints = (pointsToAnalysisId: string, pointIdsToMove: string[]) => {
//         updateAnalysis({
//             analysisId: pointsToAnalysisId,
//             analysis: {
//                 points: pointIdsToMove,
//             },
//         });
//     };

//     const rows = (props.points || [])
//         .sort((a, b) => {
//             const dateA = Date.parse(a.created_at || '');
//             const dateB = Date.parse(b.created_at || '');
//             if (isNaN(dateA) || isNaN(dateB)) {
//                 return 0;
//             }

//             return dateB - dateA;
//         })
//         .map((point, index) => ({
//             id: point.id || index,
//             x: (point?.coordinates || [])[0] || 0,
//             y: (point?.coordinates || [])[1] || 0,
//             z: (point?.coordinates || [])[2] || 0,
//             kind: point.kind,
//             space: point.space,
//         }));

//     // 70 is the height of the AnalysisPointsHeader and its border
//     // 1 is for the bottom border of the head row
//     // add one to account for column header
//     // add one to account for the "no rows message"
//     const totalTableHeight = 71 + 1 + (rows.length + 1 + (rows.length === 0 ? 1 : 0)) * ROW_HEIGHT;

//     return (
//         <Box
//             className="test-test-test"
//             sx={{ height: totalTableHeight < 600 ? `${totalTableHeight}px` : '600px' }}
//         >
//             <DataGrid
//                 loading={
//                     createPointIsLoading ||
//                     deletePointIsLoading ||
//                     updatePointIsLoading ||
//                     updateAnalysisIsLoading ||
//                     isFetching > 0
//                 }
//                 showCellRightBorder
//                 onCellEditCommit={handleCellEditCommit}
//                 disableSelectionOnClick
//                 hideFooter
//                 rowHeight={ROW_HEIGHT}
//                 checkboxSelection
//                 components={{
//                     Toolbar: AnalysisPointsHeader,
//                 }}
//                 componentsProps={{
//                     toolbar: {
//                         studyId: props.studyId,
//                         analysisId: props.analysisId,
//                         onCreatePoint: handleCreatePoint,
//                         onMovePoints: handleMovePoints,
//                     },
//                 }}
//                 rows={rows}
//                 columns={tableColumns}
//             />
//         </Box>
//     );
// };

// export default EditAnalysisPoints;

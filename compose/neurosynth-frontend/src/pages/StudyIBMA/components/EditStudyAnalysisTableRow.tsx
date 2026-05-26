import { TableCell, TableRow } from '@mui/material';
import { flexRender, type Row, type Table as TanstackTable } from '@tanstack/react-table';
import EditStudyAnalysisImagesExpandedRow from 'pages/StudyIBMA/components/EditStudyAnalysisImagesExpandedRow';
import {
    STUDY_ANALYSES_COLUMN_WIDTH,
    STUDY_ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX,
} from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.consts';
import type { AnalysisBoardRow } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.types';
import React from 'react';

export const EditStudyAnalysisTableRow: React.FC<{
    row: Row<AnalysisBoardRow>;
    table: TanstackTable<AnalysisBoardRow>;
}> = ({ row, table }) => {
    return (
        <>
            <TableRow sx={{ cursor: 'pointer' }}>
                {row.getVisibleCells().map((cell) => {
                    const isAnalysis = cell.column.id === 'analysis';
                    return (
                        <TableCell
                            key={cell.id}
                            sx={{
                                verticalAlign: 'top',
                                maxHeight: STUDY_ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX,
                                minHeight: STUDY_ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX,
                                height: STUDY_ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX,
                                p: 0,
                                ...(isAnalysis
                                    ? {
                                          width: STUDY_ANALYSES_COLUMN_WIDTH,
                                          minWidth: STUDY_ANALYSES_COLUMN_WIDTH,
                                          maxWidth: STUDY_ANALYSES_COLUMN_WIDTH,
                                          position: 'sticky',
                                          left: 0,
                                          zIndex: 6,
                                          backgroundColor: 'white',
                                          borderRight: 1,
                                          borderColor: row.getIsExpanded() ? 'transparent' : 'divider',
                                          borderRightColor: 'divider',
                                      }
                                    : {
                                          borderLeft: 1,
                                          borderColor: 'divider',
                                      }),
                            }}
                        >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                    );
                })}
            </TableRow>
            {row.getIsExpanded() ? (
                <EditStudyAnalysisImagesExpandedRow
                    row={row}
                    table={table}
                    selectedImageId={table.options.meta?.selectedImageId ?? null}
                />
            ) : null}
        </>
    );
};

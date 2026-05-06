import { TableCell, TableRow } from '@mui/material';
import { type Row, type Table as TanstackTable } from '@tanstack/react-table';
import React from 'react';
import type { AnalysisBoardRow } from '../hooks/useEditStudyAnalysisBoardState.types';
import { flexRender } from '@tanstack/react-table';
import {
    STUDY_ANALYSES_COLUMN_WIDTH,
    STUDY_ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX,
} from './editStudyAnalysisBoard.constants';

export const EditStudyAnalysisTableRow: React.FC<{
    row: Row<AnalysisBoardRow>;
    table: TanstackTable<AnalysisBoardRow>;
}> = ({ row, table }) => {
    return (
        <TableRow sx={{ cursor: 'pointer' }}>
            {row.getVisibleCells().map((cell) => {
                const isAnalysis = cell.column.id === 'analysis';
                return (
                    <TableCell
                        key={cell.id}
                        onClick={() => {
                            if (isAnalysis) row.toggleExpanded();
                        }}
                        sx={{
                            verticalAlign: 'top',
                            ':hover': {
                                backgroundColor: isAnalysis ? 'grey.200' : 'transparent',
                            },
                            minHeight: STUDY_ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX,
                            p: 0,
                            ...(isAnalysis
                                ? {
                                      width: STUDY_ANALYSES_COLUMN_WIDTH,
                                      minWidth: STUDY_ANALYSES_COLUMN_WIDTH,
                                      maxWidth: STUDY_ANALYSES_COLUMN_WIDTH,
                                      borderColor: row.getIsExpanded() ? 'transparent' : 'divider',
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
    );
};

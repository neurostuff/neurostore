import { TableCell, TableRow } from '@mui/material';
import { type Row, type Table as TanstackTable } from '@tanstack/react-table';
import React from 'react';
import type { AnalysisBoardRow } from '../hooks/useEditStudyAnalysisBoardState.types';
import { flexRender } from '@tanstack/react-table';
import {
    STUDY_ANALYSES_COLUMN_WIDTH,
    STUDY_ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX,
    studyAnalysisStickyBodySx,
} from './editStudyAnalysisBoard.constants';

export const EditStudyAnalysisTableRow: React.FC<{
    row: Row<AnalysisBoardRow>;
    table: TanstackTable<AnalysisBoardRow>;
}> = ({ row, table }) => {
    return (
        <TableRow
            hover
            onClick={() => row.toggleExpanded()}
            sx={{
                cursor: 'pointer',
                '& > td': { minHeight: STUDY_ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX },
            }}
        >
            {row.getVisibleCells().map((cell) => {
                const isAnalysis = cell.column.id === 'analysis';
                return (
                    <TableCell
                        key={cell.id}
                        sx={{
                            verticalAlign: 'top',
                            p: 0,
                            ...(isAnalysis
                                ? {
                                      ...studyAnalysisStickyBodySx,
                                      width: STUDY_ANALYSES_COLUMN_WIDTH,
                                      minWidth: STUDY_ANALYSES_COLUMN_WIDTH,
                                      maxWidth: STUDY_ANALYSES_COLUMN_WIDTH,
                                  }
                                : {
                                      borderLeft: 1,
                                      borderColor: 'divider',
                                      fontSize: '0.8125rem',
                                      minWidth: 112,
                                      width: 120,
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

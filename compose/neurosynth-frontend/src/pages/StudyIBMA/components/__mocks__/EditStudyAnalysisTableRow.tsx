import { TableCell, TableRow } from '@mui/material';
import { flexRender, type Row, type Table as TanstackTable } from '@tanstack/react-table';
import type { AnalysisBoardRow } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.types';

export const EditStudyAnalysisTableRow: React.FC<{
    row: Row<AnalysisBoardRow>;
    table: TanstackTable<AnalysisBoardRow>;
}> = ({ row }) => (
    <TableRow data-testid={`mock-table-row-${row.id}`}>
        {row.getVisibleCells().map((cell) => (
            <TableCell
                key={cell.id}
                onClick={() => {
                    if (cell.column.id === 'analysis') row.toggleExpanded();
                }}
            >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </TableCell>
        ))}
    </TableRow>
);

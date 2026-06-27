import { TableCell, TableRow } from '@mui/material';
import { flexRender, type Row, type Table as TanstackTable } from '@tanstack/react-table';
import MockEditStudyAnalysisImagesExpandedRow from 'pages/StudyIBMA/components/__mocks__/EditStudyAnalysisImagesExpandedRow';
import type { AnalysisBoardRow } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.types';

export const EditStudyAnalysisTableRow: React.FC<{
    row: Row<AnalysisBoardRow>;
    table: TanstackTable<AnalysisBoardRow>;
}> = ({ row, table }) => (
    <>
        <TableRow data-testid={`mock-table-row-${row.id}`}>
            {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
            ))}
        </TableRow>
        {row.getIsExpanded() ? <MockEditStudyAnalysisImagesExpandedRow row={row} table={table} /> : null}
    </>
);

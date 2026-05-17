import { TableCell, TableRow } from '@mui/material';
import type { Row, Table as TanstackTable } from '@tanstack/react-table';
import type { AnalysisBoardRow } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.types';

const MockEditStudyAnalysisMapsExpandedRow: React.FC<{
    row: Row<AnalysisBoardRow>;
    table: TanstackTable<AnalysisBoardRow>;
}> = ({ row }) => (
    <TableRow data-testid={`mock-expanded-row-${row.id}`}>
        <TableCell>mock-expanded-maps</TableCell>
    </TableRow>
);

export default MockEditStudyAnalysisMapsExpandedRow;

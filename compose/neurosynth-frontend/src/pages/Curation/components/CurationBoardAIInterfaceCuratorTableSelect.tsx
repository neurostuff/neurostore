import { Checkbox } from '@mui/material';
import { CellContext, HeaderContext } from '@tanstack/react-table';
import { ICurationTableStudy } from './CurationBoardAIInterfaceCuratorTable';

export const CuratorTableSelectCell: React.FC<CellContext<ICurationTableStudy, unknown>> = (props) => {
    return <Checkbox size="small" />;
};

export const CuratorTableSelectHeader: React.FC<HeaderContext<ICurationTableStudy, unknown>> = ({ table }) => {
    return <Checkbox onChange={table.getToggleAllRowsSelectedHandler()} size="small" />;
};

import { Typography } from '@mui/material';
import { CellContext } from '@tanstack/react-table';
import { ICurationTableStudy } from './CurationBoardAIInterfaceCuratorTable';

const CuratorTableCell: React.FC<CellContext<ICurationTableStudy, unknown>> = (props) => {
    const value = props.getValue();

    return (
        <Typography
            variant="caption"
            sx={{ color: value ? 'inherit' : 'warning.dark', fontSize: '10px', wordBreak: 'break-all' }}
        >
            {value || 'no data'}
        </Typography>
    );
};

export default CuratorTableCell;

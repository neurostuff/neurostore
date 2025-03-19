import { Box, Checkbox } from '@mui/material';
import { CellContext, HeaderContext } from '@tanstack/react-table';
import { ICurationTableStudy } from './CurationBoardAIInterfaceCuratorTable';
import React from 'react';

export const CuratorTableSelectCell: React.FC<CellContext<ICurationTableStudy, unknown>> = (props) => {
    const handleSelectCell = (event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
        props.row.toggleSelected(checked);
    };

    return (
        <Box onClick={(e) => e.stopPropagation()} sx={{ width: '100%', padding: '4px 8px' }}>
            <Checkbox size="small" checked={props.row.getIsSelected()} onChange={handleSelectCell} />
        </Box>
    );
};

export const CuratorTableSelectHeader: React.FC<HeaderContext<ICurationTableStudy, unknown>> = ({ table }) => {
    const isSelected = table.getIsAllRowsSelected();
    const isIndeterminate = table.getIsSomeRowsSelected();

    return (
        <Box sx={{ width: '100%' }}>
            <Checkbox
                indeterminate={isIndeterminate}
                checked={isSelected}
                onChange={table.getToggleAllRowsSelectedHandler()}
                size="small"
            />
        </Box>
    );
};

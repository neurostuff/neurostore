import { Box, Checkbox, Chip } from '@mui/material';
import { CellContext, HeaderContext } from '@tanstack/react-table';
import React from 'react';
import { ICurationTableStudy } from '../hooks/useCuratorTableState.types';
import { useProjectGetColumnForStub, useSetExclusionForStub } from 'pages/Project/store/ProjectStore';

export const CuratorTableSelectCell: React.FC<CellContext<ICurationTableStudy, unknown>> = (props) => {
    const handleSelectCell = (event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
        props.row.toggleSelected(checked);
    };

    const setExclusionForStub = useSetExclusionForStub();
    const { columnIndex } = useProjectGetColumnForStub(props.row.original.id);

    const handleRemoveExclusion = () => {
        if (columnIndex < 0 || !props.row.original.id) return;
        setExclusionForStub(columnIndex, props.row.original.id, null);
    };

    // only for the PRISMA identification column - other columns have their excluded studies filtered out
    const isExcluded = props.row.original.exclusionTagId !== null;

    if (isExcluded) {
        return (
            <Box>
                <Chip
                    color="error"
                    label="Duplicate"
                    sx={{ fontSize: '8px', padding: '0px' }}
                    size="small"
                    onDelete={() => {
                        handleRemoveExclusion();
                    }}
                />
            </Box>
        );
    }

    return (
        <Box
            onClick={(e) => e.stopPropagation()}
            sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
            <Checkbox size="small" checked={props.row.getIsSelected()} onChange={handleSelectCell} />
        </Box>
    );
};

export const CuratorTableSelectHeader: React.FC<HeaderContext<ICurationTableStudy, unknown>> = ({ table }) => {
    const isSelected = table.getIsAllRowsSelected();
    const isIndeterminate = table.getIsSomeRowsSelected();

    return (
        <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Checkbox
                indeterminate={isIndeterminate}
                checked={isSelected}
                onChange={table.getToggleAllRowsSelectedHandler()}
                size="small"
            />
        </Box>
    );
};

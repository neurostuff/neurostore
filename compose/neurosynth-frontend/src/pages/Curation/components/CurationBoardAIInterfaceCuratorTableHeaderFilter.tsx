import { Close, FilterList } from '@mui/icons-material';
import { Badge, Box, IconButton } from '@mui/material';
import { Column, Row } from '@tanstack/react-table';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import React, { useCallback, useState } from 'react';
import { ICurationTableColumnType, ICurationTableStudy } from '../hooks/useCuratorTableState.types';
import CurationBoardAIInterfaceCuratorTableHeaderFilterNumeric from './CurationBoardAIInterfaceCuratorTableHeaderFilterNumeric';
import CurationBoardAIInterfaceCuratorTableHeaderFilterText from './CurationBoardAIInterfaceCuratorTableHeaderFilterText';
import CurationBoardAIInterfaceCuratorTableHeaderFilterNestedAutocomplete from './CurationBoardAIInterfaceCuratorTableHeaderFilterNestedAutocomplete';

const CurationBoardAIInterfaceCuratorTableHeaderFilter: React.FC<{
    column: Column<ICurationTableStudy, ICurationTableColumnType>;
    filteredRows: Row<ICurationTableStudy>[];
    allRows: Row<ICurationTableStudy>[];
}> = ({ column, allRows }) => {
    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
    const isOpen = Boolean(anchorEl);
    const filterVariant = column.columnDef.meta?.filterVariant;

    const currentFilterValue = column.getFilterValue();

    const handleUpdateFilter = useCallback(
        (newVal: string[] | string | undefined | [number | undefined, number | undefined]) => {
            column.setFilterValue(newVal);
        },
        [column]
    );

    return (
        <Box>
            <Badge
                sx={{ padding: 0, '.MuiBadge-badge': { padding: 0, height: '14px', minWidth: '14px' } }}
                badgeContent={
                    currentFilterValue ? (
                        <IconButton onClick={() => handleUpdateFilter(undefined)} sx={{ padding: 0 }}>
                            <Close sx={{ fontSize: '12px', color: 'white' }} />
                        </IconButton>
                    ) : undefined
                }
                color="error"
            >
                <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small">
                    <FilterList
                        sx={{
                            height: '0.9em',
                            width: '0.9em',
                            color: currentFilterValue ? 'secondary.main' : 'lightgray',
                        }}
                    />
                </IconButton>
            </Badge>
            <NeurosynthPopper open={isOpen} onClickAway={() => setAnchorEl(null)} anchorElement={anchorEl}>
                {filterVariant === 'text' ? (
                    <CurationBoardAIInterfaceCuratorTableHeaderFilterText
                        value={currentFilterValue as string}
                        onClose={() => setAnchorEl(null)}
                        onChange={handleUpdateFilter}
                    />
                ) : filterVariant === 'numeric' ? (
                    <CurationBoardAIInterfaceCuratorTableHeaderFilterNumeric
                        rows={allRows}
                        accessorFn={column.accessorFn}
                        value={currentFilterValue as [number | undefined, number | undefined] | undefined}
                        onChange={handleUpdateFilter}
                    />
                ) : filterVariant === 'autocomplete' ? (
                    <CurationBoardAIInterfaceCuratorTableHeaderFilterNestedAutocomplete
                        rows={allRows}
                        value={currentFilterValue as string[]}
                        onChange={handleUpdateFilter}
                        accessorFn={column.accessorFn}
                    />
                ) : (
                    <></>
                )}
            </NeurosynthPopper>
        </Box>
    );
};

export default CurationBoardAIInterfaceCuratorTableHeaderFilter;

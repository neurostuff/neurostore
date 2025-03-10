import { Close, FilterList } from '@mui/icons-material';
import { Badge, Box, IconButton } from '@mui/material';
import DebouncedTextField from 'components/DebouncedTextField';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import React, { useCallback, useState } from 'react';
import { ICurationTableStudy } from './CurationBoardAIInterfaceCuratorTable';
import { Column } from '@tanstack/react-table';

const CurationBoardAIInterfaceCuratorTableHeaderFilter: React.FC<{
    column: Column<ICurationTableStudy, unknown>;
}> = ({ column }) => {
    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
    const isOpen = Boolean(anchorEl);
    const filterVariant = column.columnDef.meta?.filterVariant;

    const currentFilterValue = column.getFilterValue();

    const handleChangeTextFilter = useCallback(
        (text: string | undefined) => {
            column.setFilterValue(text);
        },
        [column]
    );

    const handleChangeNumericFilterMin = useCallback(
        (value: string | undefined) => {
            column.setFilterValue((old: [number, number]) => [value, old?.[1]]);
        },
        [column]
    );

    const handleChangeNumericFilterMax = useCallback((value: string | undefined) => {
        column.setFilterValue((old: [number, number]) => [old?.[0], value]);
    }, []);

    switch (filterVariant) {
        case 'text':
            return (
                <Box>
                    <Badge
                        sx={{ padding: 0, '.MuiBadge-badge': { padding: 0, height: '14px', minWidth: '14px' } }}
                        badgeContent={
                            currentFilterValue ? (
                                <IconButton onClick={() => handleChangeTextFilter(undefined)} sx={{ padding: 0 }}>
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
                        <Box sx={{ padding: '0.5rem' }}>
                            <DebouncedTextField
                                size="small"
                                placeholder="Filter"
                                value={currentFilterValue as string}
                                sx={{
                                    '.MuiInputBase-root': { paddingRight: '0px !important' },
                                    width: '200px',
                                    input: { fontSize: '12px' },
                                }}
                                onChange={handleChangeTextFilter}
                                InputProps={{
                                    endAdornment: (
                                        <IconButton size="small" onClick={() => handleChangeTextFilter(undefined)}>
                                            <Close />
                                        </IconButton>
                                    ),
                                }}
                            />
                        </Box>
                    </NeurosynthPopper>
                </Box>
            );
        case 'numeric': {
            const min = (currentFilterValue as [number, number])?.[0]?.toString() || '';
            const max = (currentFilterValue as [number, number])?.[1]?.toString() || '';

            return (
                <Box>
                    <Badge
                        sx={{ padding: 0, '.MuiBadge-badge': { padding: 0, height: '14px', minWidth: '14px' } }}
                        badgeContent={
                            currentFilterValue ? (
                                <IconButton
                                    onClick={() => {
                                        column.setFilterValue(undefined);
                                    }}
                                    sx={{ padding: 0 }}
                                >
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
                        <Box
                            sx={{ padding: '0.5rem', width: '210px', display: 'flex', justifyContent: 'space-between' }}
                        >
                            <DebouncedTextField
                                size="small"
                                type="number"
                                placeholder="Min"
                                value={min}
                                sx={{
                                    '.MuiInputBase-root': { paddingRight: '0px !important' },
                                    width: '100px',
                                    input: { fontSize: '12px' },
                                }}
                                onChange={handleChangeNumericFilterMin}
                                InputProps={{
                                    endAdornment: (
                                        <IconButton
                                            size="small"
                                            onClick={() => {
                                                handleChangeNumericFilterMin(undefined);
                                            }}
                                        >
                                            <Close />
                                        </IconButton>
                                    ),
                                }}
                            />
                            <DebouncedTextField
                                size="small"
                                type="number"
                                placeholder="Max"
                                value={max}
                                sx={{
                                    '.MuiInputBase-root': { paddingRight: '0px !important' },
                                    width: '100px',
                                    input: { fontSize: '12px' },
                                }}
                                onChange={handleChangeNumericFilterMax}
                                InputProps={{
                                    endAdornment: (
                                        <IconButton
                                            size="small"
                                            onClick={() => {
                                                handleChangeNumericFilterMax(undefined);
                                            }}
                                        >
                                            <Close />
                                        </IconButton>
                                    ),
                                }}
                            />
                        </Box>
                    </NeurosynthPopper>
                </Box>
            );
        }
        default:
            return <></>;
    }
};

export default CurationBoardAIInterfaceCuratorTableHeaderFilter;

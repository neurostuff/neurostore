import { Add, Remove, ViewColumnRounded } from '@mui/icons-material';
import { Box, Button, List, ListItem, ListItemButton, ListItemIcon, ListItemText, ListSubheader } from '@mui/material';
import { AccessorFnColumnDef, DisplayColumnDef } from '@tanstack/react-table';
import AIICon from 'components/AIIcon';
import DebouncedTextField from 'components/DebouncedTextField';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import React, { useMemo, useState } from 'react';
import {
    ICurationTableStudy,
    PARTICIPANTS_DEMOGRAPHICS_EXTRACTOR_CURATOR_COLUMNS,
    STUB_CURATOR_COLUMNS,
    TASK_EXTRACTOR_CURATOR_COLUMNS,
} from '../hooks/useCuratorTableState.types';

const CurationBoardAIInterfaceCuratorTableManageColumns: React.FC<{
    columns: (DisplayColumnDef<ICurationTableStudy, unknown> | AccessorFnColumnDef<ICurationTableStudy, string>)[];
    onAddColumn?: (column: string) => void;
    onRemoveColumn?: (column: string) => void;
}> = ({ onAddColumn = () => {}, onRemoveColumn = () => {}, columns }) => {
    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
    const [search, setSearch] = useState<string>();

    const isOpen = Boolean(anchorEl);

    const columnsSet = useMemo(() => {
        const set = new Set();
        columns.forEach((column) => {
            set.add(column.id);
        });
        return set;
    }, [columns]);

    const handleSelectColumn = (column: string) => {
        const foundColumn = columns.find((col) => col.id === column);
        if (foundColumn) {
            onRemoveColumn(column);
        } else {
            onAddColumn(column);
        }
    };

    const filteredStubColumns = useMemo(() => {
        if (!search || search === '') return STUB_CURATOR_COLUMNS;
        return STUB_CURATOR_COLUMNS.filter((col) => col.label.toLowerCase().includes(search.toLowerCase()));
    }, [search]);

    const filteredTaskExtractionColumns = useMemo(() => {
        if (!search || search === '') return TASK_EXTRACTOR_CURATOR_COLUMNS;
        return TASK_EXTRACTOR_CURATOR_COLUMNS.filter((col) => col.id.toLowerCase().includes(search.toLowerCase()));
    }, [search]);

    const filteredParticipantsDemographicColumn = useMemo(() => {
        if (!search || search === '') return PARTICIPANTS_DEMOGRAPHICS_EXTRACTOR_CURATOR_COLUMNS;
        return PARTICIPANTS_DEMOGRAPHICS_EXTRACTOR_CURATOR_COLUMNS.filter((col) =>
            col.id.toLowerCase().includes(search.toLowerCase())
        );
    }, [search]);

    return (
        <Box>
            <Button
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => setAnchorEl(event.currentTarget)}
                sx={{ fontSize: '12px' }}
                size="small"
                startIcon={<ViewColumnRounded />}
                color="secondary"
            >
                Update Columns
            </Button>
            <NeurosynthPopper anchorElement={anchorEl} open={isOpen} onClickAway={() => setAnchorEl(null)}>
                <Box sx={{ padding: '10px', maxWidth: '180px' }}>
                    <DebouncedTextField
                        size="small"
                        placeholder="search"
                        sx={{ width: '100%', marginBottom: '8px', input: { fontSize: '12px' } }}
                        value={search}
                        onChange={setSearch}
                    />
                    <List disablePadding sx={{ maxHeight: '40vh', overflowY: 'auto' }}>
                        <ListSubheader sx={{ padding: '8px 4px', fontSize: '12px', lineHeight: 'normal' }}>
                            Study Details
                        </ListSubheader>
                        {filteredStubColumns.map((column) => (
                            <ListItem key={column.id} disablePadding>
                                <ListItemButton
                                    onClick={() => handleSelectColumn(column.id)}
                                    sx={{ padding: '2px 4px' }}
                                >
                                    <ListItemIcon sx={{ minWidth: '30px' }}>
                                        {columnsSet.has(column.id) ? (
                                            <Remove sx={{ fontSize: '18px' }} />
                                        ) : (
                                            <Add sx={{ fontSize: '18px' }} />
                                        )}
                                    </ListItemIcon>
                                    <ListItemText primaryTypographyProps={{ fontSize: '12px' }}>
                                        {column.label}
                                    </ListItemText>
                                </ListItemButton>
                            </ListItem>
                        ))}
                        <ListSubheader
                            sx={{
                                padding: '8px 4px',
                                fontSize: '12px',
                                lineHeight: 'normal',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}
                        >
                            Task Details
                            <AIICon sx={{ marginRight: '8px' }} />
                        </ListSubheader>
                        {filteredTaskExtractionColumns.map((column) => (
                            <ListItem key={column.id} disablePadding>
                                <ListItemButton
                                    onClick={() => handleSelectColumn(column.id)}
                                    sx={{ padding: '2px 4px' }}
                                >
                                    <ListItemIcon sx={{ minWidth: '30px' }}>
                                        {columnsSet.has(column.id) ? (
                                            <Remove sx={{ fontSize: '18px' }} />
                                        ) : (
                                            <Add sx={{ fontSize: '18px' }} />
                                        )}
                                    </ListItemIcon>
                                    <ListItemText primaryTypographyProps={{ fontSize: '12px' }}>
                                        {column.label}
                                    </ListItemText>
                                </ListItemButton>
                            </ListItem>
                        ))}
                        <ListSubheader
                            sx={{
                                padding: '8px 4px',
                                fontSize: '12px',
                                lineHeight: 'normal',
                                display: 'flex',
                                justifyContent: 'space-between',
                            }}
                        >
                            Participant Demographic Details
                            <AIICon sx={{ marginRight: '8px' }} />
                        </ListSubheader>
                        {filteredParticipantsDemographicColumn.map((column) => (
                            <ListItem key={column.id} disablePadding>
                                <ListItemButton
                                    onClick={() => handleSelectColumn(column.id)}
                                    sx={{ padding: '2px 4px' }}
                                >
                                    <ListItemIcon sx={{ minWidth: '30px' }}>
                                        {columnsSet.has(column.id) ? (
                                            <Remove sx={{ fontSize: '18px' }} />
                                        ) : (
                                            <Add sx={{ fontSize: '18px' }} />
                                        )}
                                    </ListItemIcon>
                                    <ListItemText primaryTypographyProps={{ fontSize: '12px' }}>
                                        {column.label}
                                    </ListItemText>
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>
                </Box>
            </NeurosynthPopper>
        </Box>
    );
};

export default CurationBoardAIInterfaceCuratorTableManageColumns;

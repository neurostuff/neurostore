import { Add, Remove } from '@mui/icons-material';
import {
    Box,
    Button,
    Checkbox,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    ListSubheader,
    Typography,
} from '@mui/material';
import { AccessorFnColumnDef, DisplayColumnDef } from '@tanstack/react-table';
import AIICon from 'components/AIIcon';
import DebouncedTextField from 'components/DebouncedTextField';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import ToDocsIcon from 'components/ToDocsIcon';
import React, { useMemo, useState } from 'react';
import { ICurationTableStudy } from '../hooks/useCuratorTableState.types';
import {
    PARTICIPANTS_DEMOGRAPHICS_EXTRACTOR_CURATOR_COLUMNS,
    STUB_CURATOR_COLUMNS,
    TASK_EXTRACTOR_CURATOR_COLUMNS,
} from '../hooks/useCuratorTableState.consts';

const CurationBoardAIInterfaceCuratorTableManageColumns: React.FC<{
    columns: (DisplayColumnDef<ICurationTableStudy, unknown> | AccessorFnColumnDef<ICurationTableStudy, string>)[];
    onAddColumn?: (column: string) => void;
    onRemoveColumn?: (column: string) => void;
    allowAIColumns: boolean;
}> = ({ onAddColumn = () => {}, onRemoveColumn = () => {}, columns, allowAIColumns }) => {
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
        return STUB_CURATOR_COLUMNS.filter((col) => col.label.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
    }, [search]);

    const filteredTaskExtractionColumns = useMemo(() => {
        if (!search || search === '') return TASK_EXTRACTOR_CURATOR_COLUMNS;
        return TASK_EXTRACTOR_CURATOR_COLUMNS.filter((col) =>
            col.label.toLocaleLowerCase().includes(search.toLocaleLowerCase())
        );
    }, [search]);

    const filteredParticipantsDemographicColumn = useMemo(() => {
        if (!search || search === '') return PARTICIPANTS_DEMOGRAPHICS_EXTRACTOR_CURATOR_COLUMNS;
        return PARTICIPANTS_DEMOGRAPHICS_EXTRACTOR_CURATOR_COLUMNS.filter((col) =>
            col.label.toLocaleLowerCase().includes(search.toLocaleLowerCase())
        );
    }, [search]);

    return (
        <Box>
            <Button
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => setAnchorEl(event.currentTarget)}
                sx={{ fontSize: '12px', height: '30px' }}
                size="small"
                startIcon={
                    <Box sx={{ display: 'flex' }}>
                        <Add fontSize="small" />
                        <Remove fontSize="small" />
                    </Box>
                }
                color="secondary"
            >
                Columns
            </Button>
            <NeurosynthPopper anchorElement={anchorEl} open={isOpen} onClickAway={() => setAnchorEl(null)}>
                <Box sx={{ padding: '10px', maxWidth: '250px' }}>
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
                        {filteredStubColumns.length === 0 && (
                            <Typography
                                variant="body2"
                                sx={{ color: 'warning.dark', fontSize: '12px', padding: '0px 16px' }}
                            >
                                No results
                            </Typography>
                        )}
                        {filteredStubColumns.map((column) => (
                            <ListItem key={column.id} disablePadding>
                                <ListItemButton
                                    onClick={() => handleSelectColumn(column.id)}
                                    sx={{ padding: '2px 4px' }}
                                >
                                    <Checkbox checked={columnsSet.has(column.id)} size="small" />
                                    <ListItemText primaryTypographyProps={{ fontSize: '12px' }}>
                                        {column.label}
                                    </ListItemText>
                                </ListItemButton>
                            </ListItem>
                        ))}
                        {allowAIColumns && (
                            <>
                                <ListSubheader
                                    sx={{
                                        padding: '8px 4px',
                                        fontSize: '12px',
                                        lineHeight: 'normal',
                                        display: 'flex',
                                        alignItems: 'center',
                                    }}
                                >
                                    <AIICon sx={{ marginRight: '4px' }} />
                                    Experimental Details
                                </ListSubheader>
                                {filteredTaskExtractionColumns.length === 0 && (
                                    <Typography
                                        variant="body2"
                                        sx={{ color: 'warning.dark', fontSize: '12px', padding: '0px 16px' }}
                                    >
                                        No results
                                    </Typography>
                                )}
                                {filteredTaskExtractionColumns.map((column) => (
                                    <ListItem key={column.id} disablePadding>
                                        <ListItemButton
                                            onClick={() => handleSelectColumn(column.id)}
                                            sx={{ padding: '2px 4px' }}
                                        >
                                            <Checkbox checked={columnsSet.has(column.id)} size="small" />
                                            <ListItemText primaryTypographyProps={{ fontSize: '12px' }}>
                                                {column.label}
                                            </ListItemText>
                                            <ListItemIcon sx={{ minWidth: '0px' }}>
                                                <ToDocsIcon
                                                    url={`guide/Project/Curation#${column.id.replace('.', '').toLocaleLowerCase()}`}
                                                />
                                            </ListItemIcon>
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
                                    }}
                                >
                                    <AIICon sx={{ marginRight: '8px' }} />
                                    Participant Demographics
                                </ListSubheader>
                                {filteredParticipantsDemographicColumn.length === 0 && (
                                    <Typography
                                        variant="body2"
                                        sx={{ color: 'warning.dark', fontSize: '12px', padding: '0px 16px' }}
                                    >
                                        No results
                                    </Typography>
                                )}
                                {filteredParticipantsDemographicColumn.map((column) => (
                                    <ListItem key={column.id} disablePadding>
                                        <ListItemButton
                                            onClick={() => handleSelectColumn(column.id)}
                                            sx={{ padding: '0px 4px' }}
                                        >
                                            <Checkbox checked={columnsSet.has(column.id)} size="small" />
                                            <ListItemText primaryTypographyProps={{ fontSize: '12px' }}>
                                                {column.label}
                                            </ListItemText>
                                            <ListItemIcon sx={{ minWidth: '0px' }}>
                                                <ToDocsIcon url={`guide/Project/Curation#${column.id}`} />
                                            </ListItemIcon>
                                        </ListItemButton>
                                    </ListItem>
                                ))}
                            </>
                        )}
                    </List>
                </Box>
            </NeurosynthPopper>
        </Box>
    );
};

export default CurationBoardAIInterfaceCuratorTableManageColumns;

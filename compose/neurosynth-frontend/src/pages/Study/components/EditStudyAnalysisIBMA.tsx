import { Add } from '@mui/icons-material';
import DriveFileMoveOutlinedIcon from '@mui/icons-material/DriveFileMoveOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import {
    Box,
    Button,
    Checkbox,
    Chip,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Menu,
    MenuItem,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import BaseDialog from 'components/Dialogs/BaseDialog';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import { useAddOrUpdateAnalysis, useDeleteAnalysis, useStudyAnalyses, useStudyId } from 'pages/Study/store/StudyStore';
import { DefaultMapTypes } from 'pages/Study/store/StudyStore.helpers';
import type { IStoreAnalysis } from 'pages/Study/store/StudyStore.helpers';
import React, { useCallback, useState } from 'react';
import { useCreateAnnotationNote } from 'stores/AnnotationStore.actions';

/** Placeholder type for brain maps not yet assigned to an analysis/contrast */
export interface IUncategorizedBrainMap {
    id: string;
    name: string;
    mapType: keyof typeof DefaultMapTypes;
}

const NARROW_COLUMN_WIDTH = { xs: '160px', md: '220px' };
const LIST_MAX_HEIGHT = '400px';

/** Mock data for uncategorized maps; replace with real data from store/API when available */
const MOCK_UNCATEGORIZED_MAPS: IUncategorizedBrainMap[] = [
    { id: 'm1', name: 'contrast_001_t', mapType: 'T' },
    { id: 'm2', name: 'contrast_002_z', mapType: 'Z' },
    { id: 'm3', name: 'mask_roi', mapType: 'R' },
];

const EditStudyAnalysisIBMA: React.FC = () => {
    const analyses = useStudyAnalyses();
    const studyId = useStudyId();
    const addOrUpdateAnalysis = useAddOrUpdateAnalysis();
    const deleteAnalysis = useDeleteAnalysis();
    const createAnnotationNote = useCreateAnnotationNote();

    const [uncategorizedMaps, setUncategorizedMaps] = useState<IUncategorizedBrainMap[]>(() => [
        ...MOCK_UNCATEGORIZED_MAPS,
    ]);
    /** Maps that have been moved into each analysis (analysisId -> list of maps) */
    const [mapsByAnalysisId, setMapsByAnalysisId] = useState<Record<string, IUncategorizedBrainMap[]>>({});
    /** Which map is selected for the detail panel (column 3) */
    const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
    /** Which analyses are "selected" (enabled); unchecked = grey/disabled title */
    const [analysisEnabled, setAnalysisEnabled] = useState<Record<string, boolean>>({});
    const [moveAnchorEl, setMoveAnchorEl] = useState<{ el: HTMLElement; mapId: string } | null>(null);
    const [analysisMenuAnchor, setAnalysisMenuAnchor] = useState<{ el: HTMLElement; analysis: IStoreAnalysis } | null>(
        null
    );
    const [editModalAnalysis, setEditModalAnalysis] = useState<IStoreAnalysis | null>(null);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [deleteConfirmAnalysisId, setDeleteConfirmAnalysisId] = useState<string | null>(null);

    const handleCreateNewAnalysis = useCallback(() => {
        if (!studyId) return;
        const createdAnalysis = addOrUpdateAnalysis({
            name: '',
            description: '',
            isNew: true,
            conditions: [],
            order: analyses.length + 1,
        });
        if (!createdAnalysis.id) return;
        createAnnotationNote(createdAnalysis.id, studyId, '');
    }, [studyId, addOrUpdateAnalysis, analyses.length, createAnnotationNote]);

    const handleMoveClick = useCallback((event: React.MouseEvent<HTMLElement>, mapId: string) => {
        event.stopPropagation();
        setMoveAnchorEl({ el: event.currentTarget, mapId });
    }, []);

    const handleMoveToAnalysis = useCallback(
        (mapId: string, analysisId: string) => {
            setMoveAnchorEl(null);
            const map = uncategorizedMaps.find((m) => m.id === mapId);
            if (!map) return;
            setUncategorizedMaps((prev) => prev.filter((m) => m.id !== mapId));
            setMapsByAnalysisId((prev) => ({
                ...prev,
                [analysisId]: [...(prev[analysisId] ?? []), map],
            }));
            // TODO: wire to store – assign map to analysis (e.g. add image to analysis)
        },
        [uncategorizedMaps]
    );

    const handleAnalysisMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>, analysis: IStoreAnalysis) => {
        event.stopPropagation();
        setAnalysisMenuAnchor({ el: event.currentTarget, analysis });
    }, []);

    const handleAnalysisMenuClose = useCallback(() => {
        setAnalysisMenuAnchor(null);
    }, []);

    const handleEditAnalysis = useCallback(() => {
        const a = analysisMenuAnchor?.analysis;
        if (!a) return;
        setEditModalAnalysis(a);
        setEditName(a.name ?? '');
        setEditDescription(a.description ?? '');
        setAnalysisMenuAnchor(null);
    }, [analysisMenuAnchor?.analysis]);

    const handleCloseEditModal = useCallback(() => {
        setEditModalAnalysis(null);
        setEditName('');
        setEditDescription('');
    }, []);

    const handleSaveEditAnalysis = useCallback(() => {
        if (!editModalAnalysis?.id) return;
        addOrUpdateAnalysis({
            id: editModalAnalysis.id,
            name: editName,
            description: editDescription,
        });
        handleCloseEditModal();
    }, [addOrUpdateAnalysis, editModalAnalysis?.id, editName, editDescription, handleCloseEditModal]);

    const handleDeleteAnalysisClick = useCallback(() => {
        const id = analysisMenuAnchor?.analysis?.id;
        if (id) setDeleteConfirmAnalysisId(id);
        setAnalysisMenuAnchor(null);
    }, [analysisMenuAnchor?.analysis?.id]);

    const handleDeleteConfirm = useCallback(
        (confirm: boolean | undefined) => {
            if (confirm && deleteConfirmAnalysisId) {
                deleteAnalysis(deleteConfirmAnalysisId);
                setMapsByAnalysisId((prev) => {
                    const next = { ...prev };
                    delete next[deleteConfirmAnalysisId];
                    return next;
                });
                if (selectedMapId && mapsByAnalysisId[deleteConfirmAnalysisId]?.some((m) => m.id === selectedMapId)) {
                    setSelectedMapId(null);
                }
            }
            setDeleteConfirmAnalysisId(null);
        },
        [deleteAnalysis, deleteConfirmAnalysisId, selectedMapId, mapsByAnalysisId]
    );

    const handleRemoveMapFromAnalysis = useCallback(
        (analysisId: string, map: IUncategorizedBrainMap) => {
            setMapsByAnalysisId((prev) => ({
                ...prev,
                [analysisId]: (prev[analysisId] ?? []).filter((m) => m.id !== map.id),
            }));
            setUncategorizedMaps((prev) => [...prev, map]);
            if (selectedMapId === map.id) setSelectedMapId(null);
        },
        [selectedMapId]
    );

    const handleAnalysisCheckboxChange = useCallback((analysisId: string, checked: boolean) => {
        setAnalysisEnabled((prev) => ({ ...prev, [analysisId]: checked }));
    }, []);

    const isAnalysisEnabled = useCallback(
        (analysisId: string) => analysisEnabled[analysisId] !== false,
        [analysisEnabled]
    );

    return (
        <Box sx={{ display: 'flex', width: '100%', minHeight: 320 }}>
            {/* Column 1: Maps yet to be categorized */}
            <Box
                sx={{
                    width: NARROW_COLUMN_WIDTH,
                    flexShrink: 0,
                    borderRight: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    flexDirection: 'column',
                    pr: '1rem',
                }}
            >
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    Uncategorized maps
                </Typography>
                <List
                    sx={{
                        maxHeight: LIST_MAX_HEIGHT,
                        overflow: 'auto',
                    }}
                >
                    {uncategorizedMaps.map((map) => (
                        <ListItem key={map.id} disablePadding>
                            <ListItemButton
                                selected={selectedMapId === map.id}
                                onClick={() => setSelectedMapId(map.id)}
                                sx={{ py: 0.5, minHeight: 36, px: 1 }}
                            >
                                <ListItemText
                                    primary={map.name}
                                    primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                                    sx={{ flex: '1 1 auto', minWidth: 0 }}
                                />
                                <Chip
                                    size="small"
                                    label={DefaultMapTypes[map.mapType]?.label ?? map.mapType}
                                    sx={{ flexShrink: 0, height: 20, fontSize: '0.7rem' }}
                                />
                                <Tooltip title="move tø analysis">
                                    <IconButton
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleMoveClick(e, map.id);
                                        }}
                                        aria-label="Categorize map"
                                        sx={{ flexShrink: 0, p: 0.25 }}
                                    >
                                        <DriveFileMoveOutlinedIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
                <Menu
                    open={Boolean(moveAnchorEl)}
                    anchorEl={moveAnchorEl?.el ?? null}
                    onClose={() => setMoveAnchorEl(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                    {analyses.map((a) => (
                        <MenuItem
                            key={a.id}
                            onClick={() => moveAnchorEl && handleMoveToAnalysis(moveAnchorEl.mapId, a.id!)}
                        >
                            {a.name || 'Untitled'}
                        </MenuItem>
                    ))}
                    {analyses.length === 0 && <MenuItem disabled>No analyses yet</MenuItem>}
                </Menu>
            </Box>

            {/* Column 2: Analyses list */}
            <Box
                sx={{
                    width: NARROW_COLUMN_WIDTH,
                    flexShrink: 0,
                    borderRight: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '0rem 1rem',
                }}
            >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                        Analyses
                    </Typography>
                    <Button
                        size="small"
                        variant="contained"
                        disableElevation
                        sx={{ fontSize: '10px' }}
                        onClick={handleCreateNewAnalysis}
                        startIcon={<Add sx={{ fontSize: '16px' }} />}
                    >
                        analysis
                    </Button>
                </Box>
                <List
                    disablePadding
                    sx={{
                        maxHeight: LIST_MAX_HEIGHT,
                        overflow: 'auto',
                    }}
                >
                    {analyses.map((analysis) => {
                        const analysisId = analysis.id!;
                        const enabled = isAnalysisEnabled(analysisId);
                        const mapsInAnalysis = mapsByAnalysisId[analysisId] ?? [];
                        return (
                            <Box key={analysisId} component="li" sx={{ listStyle: 'none' }}>
                                <ListItem
                                    disablePadding
                                    sx={{
                                        alignItems: 'flex-start',
                                        py: 0.5,
                                        pr: 0.5,
                                    }}
                                >
                                    <Tooltip title={enabled ? 'exclude analysis' : 'include analysis'}>
                                        <Checkbox
                                            size="small"
                                            checked={enabled}
                                            onChange={(_, checked) => handleAnalysisCheckboxChange(analysisId, checked)}
                                            sx={{ p: 0, mr: 1, my: 1 }}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </Tooltip>
                                    <ListItemText
                                        primary={analysis.name || 'Untitled'}
                                        secondary={analysis.description || 'No description'}
                                        primaryTypographyProps={{
                                            variant: 'body2',
                                            fontWeight: 'bold',
                                            color: enabled
                                                ? !analysis.name
                                                    ? 'warning.dark'
                                                    : undefined
                                                : 'text.disabled',
                                        }}
                                        secondaryTypographyProps={{
                                            variant: 'caption',
                                            lineHeight: 'normal',
                                            color: enabled
                                                ? !analysis.description
                                                    ? 'warning.dark'
                                                    : undefined
                                                : 'text.disabled',
                                        }}
                                        sx={{ flex: '1 1 auto', minWidth: 0 }}
                                    />
                                    <IconButton
                                        size="small"
                                        onClick={(e) => handleAnalysisMenuOpen(e, analysis)}
                                        aria-label="Analysis options"
                                        sx={{ flexShrink: 0, p: 0.25 }}
                                    >
                                        <MoreVertIcon fontSize="small" />
                                    </IconButton>
                                </ListItem>
                                {mapsInAnalysis.length === 0 ? (
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            pl: 3.5,
                                            py: 0.5,
                                            display: 'block',
                                            color: enabled ? 'warning.dark' : 'text.disabled',
                                        }}
                                    >
                                        no brain maps
                                    </Typography>
                                ) : (
                                    mapsInAnalysis.map((map) => (
                                        <ListItem key={map.id} disablePadding sx={{ pl: 3.5 }}>
                                            <ListItemButton
                                                disabled={!enabled}
                                                selected={enabled && selectedMapId === map.id}
                                                onClick={() => setSelectedMapId(map.id)}
                                                sx={{ py: 0.5, minHeight: 36 }}
                                            >
                                                <ListItemText
                                                    primary={map.name}
                                                    primaryTypographyProps={{
                                                        variant: 'body2',
                                                        noWrap: true,
                                                        color: enabled ? undefined : 'text.disabled',
                                                    }}
                                                    sx={{ flex: '1 1 auto', minWidth: 0 }}
                                                />
                                                <Chip
                                                    size="small"
                                                    label={DefaultMapTypes[map.mapType]?.label ?? map.mapType}
                                                    sx={{
                                                        flexShrink: 0,
                                                        height: 18,
                                                        fontSize: '0.65rem',
                                                        ...(!enabled && { opacity: 0.6 }),
                                                    }}
                                                />
                                                <IconButton
                                                    size="small"
                                                    disabled={!enabled}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRemoveMapFromAnalysis(analysisId, map);
                                                    }}
                                                    aria-label="Remove from analysis"
                                                    sx={{ flexShrink: 0, p: 0.25, ml: 0.25 }}
                                                >
                                                    <RemoveCircleOutlineIcon fontSize="small" />
                                                </IconButton>
                                            </ListItemButton>
                                        </ListItem>
                                    ))
                                )}
                            </Box>
                        );
                    })}
                </List>
                <Menu
                    open={Boolean(analysisMenuAnchor)}
                    anchorEl={analysisMenuAnchor?.el ?? null}
                    onClose={handleAnalysisMenuClose}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                    <MenuItem onClick={handleEditAnalysis}>Edit analysis</MenuItem>
                    <MenuItem onClick={handleDeleteAnalysisClick} sx={{ color: 'error.main' }}>
                        Delete analysis
                    </MenuItem>
                </Menu>
            </Box>

            {/* Column 3: Brain map detail placeholder */}
            <Box
                sx={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderColor: 'divider',
                }}
            >
                <Typography variant="h6" color="text.secondary">
                    TODO: Map metadata goes here. (What does the metadata look like? Need to know this in order to
                    figure out how to display it.)
                </Typography>
            </Box>

            {/* Edit analysis modal */}
            <BaseDialog
                isOpen={Boolean(editModalAnalysis)}
                dialogTitle="Edit analysis"
                onCloseDialog={handleCloseEditModal}
                fullWidth
                maxWidth="sm"
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                    <TextField
                        label="Name"
                        size="small"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        fullWidth
                    />
                    <TextField
                        label="Description"
                        size="small"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        fullWidth
                        multiline
                        rows={3}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                        <Button onClick={handleCloseEditModal} variant="text">
                            Cancel
                        </Button>
                        <Button onClick={handleSaveEditAnalysis} variant="contained" disableElevation>
                            Save
                        </Button>
                    </Box>
                </Box>
            </BaseDialog>

            <ConfirmationDialog
                isOpen={Boolean(deleteConfirmAnalysisId)}
                onCloseDialog={handleDeleteConfirm}
                dialogTitle="Delete analysis?"
                dialogMessage="This analysis will be removed. This action cannot be undone."
                confirmText="Delete"
                rejectText="Cancel"
                confirmButtonProps={{ color: 'error' }}
            />
        </Box>
    );
};

export default EditStudyAnalysisIBMA;

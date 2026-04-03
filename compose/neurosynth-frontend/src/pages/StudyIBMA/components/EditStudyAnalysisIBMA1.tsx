import { Add } from '@mui/icons-material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
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
    Paper,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams, GridRowParams } from '@mui/x-data-grid';
import type { GridRowClassNameParams } from '@mui/x-data-grid/models';
import BaseDialog from 'components/Dialogs/BaseDialog';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import { useAddOrUpdateAnalysis, useDeleteAnalysis, useStudyAnalyses, useStudyId } from 'stores/study/StudyStore';
import { DefaultMapTypes } from 'stores/study/StudyStore.helpers';
import type { IStoreAnalysis } from 'stores/study/StudyStore.helpers';
import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useCreateAnnotationNote } from 'stores/annotation/AnnotationStore.actions';

/** Placeholder type for brain maps not yet assigned to an analysis/contrast */
export interface IUncategorizedBrainMap {
    id: string;
    name: string;
    mapType: keyof typeof DefaultMapTypes;
}

const NARROW_COLUMN_WIDTH = { xs: '160px', md: '300px' };
/** Width of uncategorized column when collapsed to a thin expand control */
const UNCATEGORIZED_COLLAPSED_WIDTH = 40;

/** Mock data for uncategorized maps; replace with real data from store/API when available */
const MOCK_UNCATEGORIZED_MAPS: IUncategorizedBrainMap[] = [
    { id: 'm1', name: 'contrast_001_t', mapType: 'T' },
    { id: 'm2', name: 'contrast_002_z', mapType: 'Z' },
    { id: 'm3', name: 'mask_roi', mapType: 'R' },
];

/** Mock annotation columns until real annotation fields are wired to the grid */
const MOCK_ANNOTATION_COLUMNS = [
    { field: 'mockAnnotationNote', headerName: 'Included', type: 'boolean' },
    { field: 'mockReviewer', headerName: 'Reviewer', type: 'string' },
    { field: 'mockQuality', headerName: 'Quality', type: 'string' },
    { field: 'mockNotes', headerName: 'Notes', type: 'string' },
    { field: 'mockTags', headerName: 'Tags', type: 'string' },
    { field: 'mockAuthors', headerName: 'Authors', type: 'string' },
    { field: 'mockPublication', headerName: 'Publication', type: 'string' },
    { field: 'mockStudyName', headerName: 'Study Name', type: 'string' },
    { field: 'mockStudyYear', headerName: 'Study Year', type: 'number' },
    { field: 'mockStudyPublication', headerName: 'Study Publication', type: 'string' },
    { field: 'mockStudyAuthors', headerName: 'Study Authors', type: 'string' },
    { field: 'mockStudyJournal', headerName: 'Study Journal', type: 'string' },
    { field: 'mockStudyVolume', headerName: 'Study Volume', type: 'number' },
    { field: 'mockStudyIssue', headerName: 'Study Issue', type: 'number' },
    { field: 'mockStudyPages', headerName: 'Study Pages', type: 'number' },
    { field: 'mockStudyDoi', headerName: 'Study DOI', type: 'string' },
] as const;

const MOCK_ANNOTATION_VALUE_POOLS: Record<
    (typeof MOCK_ANNOTATION_COLUMNS)[number]['field'],
    Array<string | boolean | number>
> = {
    mockAnnotationNote: [true, false, true, false],
    mockReviewer: ['JD', 'AK', '—'],
    mockQuality: ['Good', 'Fair', 'Pending'],
    mockNotes: ['Note 1', 'Note 2', 'Note 3'],
    mockTags: ['Tag 1', 'Tag 2', 'Tag 3'],
    mockAuthors: ['Author 1', 'Author 2', 'Author 3'],
    mockPublication: ['Publication 1', 'Publication 2', 'Publication 3'],
    mockStudyName: ['Study Name 1', 'Study Name 2', 'Study Name 3'],
    mockStudyYear: [2020, 2021, 2022],
    mockStudyPublication: ['Study Publication 1', 'Study Publication 2', 'Study Publication 3'],
    mockStudyAuthors: ['Study Authors 1', 'Study Authors 2', 'Study Authors 3'],
    mockStudyJournal: ['Study Journal 1', 'Study Journal 2', 'Study Journal 3'],
    mockStudyVolume: [1, 2, 3],
    mockStudyIssue: [1, 2, 3],
    mockStudyPages: [1, 2, 3],
    mockStudyDoi: ['DOI 1', 'DOI 2', 'DOI 3'],
};

const BRAIN_MAPS_DETAIL_ROW_SUFFIX = '__brainMaps';

type AnalysisGridRowKind = 'analysis' | 'detail';

interface IAnalysisGridRow {
    id: string;
    rowKind: AnalysisGridRowKind;
    name: string;
    description: string;
    parentAnalysisId?: string;
    mockAnnotationNote?: boolean | string;
    mockReviewer?: string;
    mockQuality?: string;
}

const ANNOTATION_COLUMN_COUNT = MOCK_ANNOTATION_COLUMNS.length;
const FULL_GRID_COL_SPAN = 1 + ANNOTATION_COLUMN_COUNT;

const VIRTUAL_SCROLLER_SELECTOR = '.MuiDataGrid-virtualScroller';

const EditStudyAnalysisIBMA1: React.FC = () => {
    const dataGridContainerRef = useRef<HTMLDivElement>(null);
    /** Horizontal scroll of the grid viewport; used to counteract MUI's translate on the first column. */
    const [pinnedColScrollLeft, setPinnedColScrollLeft] = useState(0);

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
    const [uncategorizedCollapsed, setUncategorizedCollapsed] = useState(false);
    /** Which analyses show brain maps in an expanded detail row */
    const [expandedAnalysisIds, setExpandedAnalysisIds] = useState<Set<string>>(() => new Set());

    const toggleAnalysisExpanded = useCallback((analysisId: string) => {
        setExpandedAnalysisIds((prev) => {
            const next = new Set(prev);
            if (next.has(analysisId)) next.delete(analysisId);
            else next.add(analysisId);
            return next;
        });
    }, []);

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

    const handleAnalysisCheckboxChange = useCallback((analysisId: string, checked: boolean) => {
        setAnalysisEnabled((prev) => ({ ...prev, [analysisId]: checked }));
    }, []);

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

    const analysisGridRows = useMemo((): IAnalysisGridRow[] => {
        const rows: IAnalysisGridRow[] = [];
        analyses.forEach((a, idx) => {
            const id = a.id!;
            const mockEntries = MOCK_ANNOTATION_COLUMNS.map(({ field }) => {
                const pool = MOCK_ANNOTATION_VALUE_POOLS[field];
                return [field, pool[idx % pool.length]] as const;
            });
            rows.push({
                id,
                rowKind: 'analysis',
                name: a.name ?? '',
                description: a.description ?? '',
                ...Object.fromEntries(mockEntries),
            });
            if (expandedAnalysisIds.has(id)) {
                rows.push({
                    id: `${id}${BRAIN_MAPS_DETAIL_ROW_SUFFIX}`,
                    rowKind: 'detail',
                    parentAnalysisId: id,
                    name: '',
                    description: '',
                });
            }
        });
        return rows;
    }, [analyses, expandedAnalysisIds]);

    /** Community DataGrid does not expose `apiRef`; sync scroll from the virtual scroller DOM. */
    useLayoutEffect(() => {
        const root = dataGridContainerRef.current;
        if (!root) return undefined;

        let cleanup: (() => void) | undefined;
        const tryBind = () => {
            const scroller = root.querySelector<HTMLElement>(VIRTUAL_SCROLLER_SELECTOR);
            if (!scroller) return false;
            const onScroll = () => setPinnedColScrollLeft(scroller.scrollLeft);
            onScroll();
            scroller.addEventListener('scroll', onScroll, { passive: true });
            cleanup = () => scroller.removeEventListener('scroll', onScroll);
            return true;
        };

        let rafId: number | undefined;
        if (!tryBind()) {
            rafId = window.requestAnimationFrame(() => {
                tryBind();
            });
        }

        return () => {
            if (rafId !== undefined) window.cancelAnimationFrame(rafId);
            cleanup?.();
        };
    }, [analysisGridRows.length, expandedAnalysisIds]);

    const handleAnalysisGridRowClick = useCallback(
        (params: GridRowParams<IAnalysisGridRow>) => {
            if (params.row.rowKind !== 'analysis') return;
            toggleAnalysisExpanded(params.row.id as string);
        },
        [toggleAnalysisExpanded]
    );

    const analysisGridColumns = useMemo<GridColDef<IAnalysisGridRow>[]>(
        () => [
            {
                field: 'name',
                renderHeader: () => (
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 0.5,
                        }}
                    >
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mr: 1 }}>
                            Analyses
                        </Typography>
                        <Button
                            size="small"
                            sx={{ fontSize: '10px' }}
                            variant="contained"
                            disableElevation
                            onClick={handleCreateNewAnalysis}
                        >
                            <Add sx={{ fontSize: '16px' }} />
                            Analysis
                        </Button>
                    </Box>
                ),
                flex: 1,
                minWidth: 220,
                sortable: false,
                filterable: false,
                disableColumnMenu: true,
                headerClassName: 'ibma-grid-analysisHeader',
                cellClassName: 'ibma-grid-analysisCell',
                colSpan: (valueParams) => (valueParams.row.rowKind === 'detail' ? FULL_GRID_COL_SPAN : undefined),
                renderCell: (params: GridRenderCellParams<IAnalysisGridRow>) => {
                    if (params.row.rowKind === 'detail') {
                        const analysisId = params.row.parentAnalysisId!;
                        const maps = mapsByAnalysisId[analysisId] ?? [];
                        const enabled = analysisEnabled[analysisId] !== false;
                        return (
                            <Box
                                sx={{
                                    py: 1,
                                    pl: 1,
                                    pr: 2,
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    height: '100%',
                                }}
                            >
                                {maps.length === 0 ? (
                                    <Typography
                                        variant="caption"
                                        sx={{ color: enabled ? 'warning.dark' : 'text.disabled' }}
                                    >
                                        No brain maps assigned to this analysis
                                    </Typography>
                                ) : (
                                    maps.map((map) => (
                                        <Box
                                            key={map.id}
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 0.75,
                                                py: 0.5,
                                            }}
                                        >
                                            <ListItemButton
                                                disabled={!enabled}
                                                selected={enabled && selectedMapId === map.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedMapId(map.id);
                                                }}
                                                sx={{
                                                    flex: 1,
                                                    minWidth: 0,
                                                    py: 0.5,
                                                    minHeight: 36,
                                                    px: 1,
                                                    borderRadius: 1,
                                                }}
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
                                            </ListItemButton>
                                            <IconButton
                                                size="small"
                                                disabled={!enabled}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRemoveMapFromAnalysis(analysisId, map);
                                                }}
                                                aria-label="Remove map from analysis"
                                                sx={{ flexShrink: 0, p: 0.25 }}
                                            >
                                                <RemoveCircleOutlineIcon fontSize="small" />
                                            </IconButton>
                                        </Box>
                                    ))
                                )}
                            </Box>
                        );
                    }

                    const analysis = analyses.find((x) => x.id === params.row.id);
                    if (!analysis?.id) return null;
                    const analysisId = analysis.id;
                    const enabled = analysisEnabled[analysisId] !== false;
                    const nameMissing = !analysis.name?.trim();
                    const descMissing = !analysis.description?.trim();
                    const expanded = expandedAnalysisIds.has(analysisId);
                    return (
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 0.5,
                                py: 0.5,
                                width: '100%',
                                minWidth: 0,
                            }}
                        >
                            <Tooltip title={expanded ? 'Collapse brain maps' : 'Expand brain maps'}>
                                <IconButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleAnalysisExpanded(analysisId);
                                    }}
                                    aria-label={expanded ? 'Collapse brain maps' : 'Expand brain maps'}
                                    sx={{ flexShrink: 0, p: 0.25, mt: -0.25 }}
                                >
                                    <ChevronRightIcon
                                        fontSize="small"
                                        sx={{
                                            transform: expanded ? 'rotate(90deg)' : 'none',
                                            transition: (t) =>
                                                t.transitions.create('transform', {
                                                    duration: t.transitions.duration.shorter,
                                                }),
                                        }}
                                    />
                                </IconButton>
                            </Tooltip>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography
                                    variant="body2"
                                    fontWeight="bold"
                                    color={enabled ? (nameMissing ? 'warning.dark' : undefined) : 'text.disabled'}
                                    noWrap
                                >
                                    {analysis.name || 'Untitled'}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    display="block"
                                    lineHeight={1.2}
                                    color={
                                        enabled ? (descMissing ? 'warning.dark' : 'text.secondary') : 'text.disabled'
                                    }
                                    sx={{
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                    }}
                                >
                                    {analysis.description || 'No description'}
                                </Typography>
                            </Box>
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleAnalysisMenuOpen(e, analysis);
                                }}
                                aria-label="Analysis options"
                                sx={{ flexShrink: 0, p: 0.25, mt: -0.25 }}
                            >
                                <MoreVertIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    );
                },
            },
            ...MOCK_ANNOTATION_COLUMNS.map(({ field, headerName, type }) => ({
                field,
                headerName,
                sortable: false,
                filterable: false,
                disableColumnMenu: true,
                headerClassName: 'ibma-grid-annotationHeader',
                cellClassName: 'ibma-grid-annotationCell',
                renderCell: (params: GridRenderCellParams<IAnalysisGridRow>) => {
                    if (params.row.rowKind === 'detail') {
                        return null;
                    }
                    if (type === 'boolean') {
                        return <Checkbox checked={Boolean(params.row[field])} size="small" disabled tabIndex={-1} />;
                    }
                    if (type === 'string') {
                        return (
                            <Typography variant="body2" noWrap>
                                {params.row[field] as string}
                            </Typography>
                        );
                    }
                    if (type === 'number') {
                        return (
                            <Typography variant="body2" noWrap>
                                {params.row[field] as number}
                            </Typography>
                        );
                    }
                    return null;
                },
            })),
        ],
        [
            analyses,
            analysisEnabled,
            expandedAnalysisIds,
            handleAnalysisCheckboxChange,
            handleAnalysisMenuOpen,
            handleCreateNewAnalysis,
            handleRemoveMapFromAnalysis,
            mapsByAnalysisId,
            selectedMapId,
            toggleAnalysisExpanded,
        ]
    );

    return (
        <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
            {/* Column 1: Maps yet to be categorized (collapsible) */}
            {uncategorizedCollapsed ? (
                <Paper
                    sx={{
                        width: UNCATEGORIZED_COLLAPSED_WIDTH,
                    }}
                >
                    <Tooltip title="Show uncategorized maps" placement="right">
                        <IconButton
                            size="small"
                            onClick={() => setUncategorizedCollapsed(false)}
                            aria-label="Show uncategorized maps"
                            sx={{
                                width: '100%',
                                height: '100%',
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: 'divider',
                            }}
                        >
                            <Add fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Paper>
            ) : (
                <Paper
                    sx={{
                        width: NARROW_COLUMN_WIDTH,
                        borderRight: '1px solid',
                        p: 2,
                        borderColor: 'divider',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 0.5,
                            minWidth: 0,
                        }}
                    >
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', minWidth: 0 }} noWrap>
                            Uncategorized maps ({uncategorizedMaps.length})
                        </Typography>
                        <Tooltip title="Hide uncategorized maps">
                            <IconButton
                                size="small"
                                onClick={() => {
                                    setMoveAnchorEl(null);
                                    setUncategorizedCollapsed(true);
                                }}
                                aria-label="Hide uncategorized maps"
                                sx={{ flexShrink: 0, p: 0.25 }}
                            >
                                <ChevronLeftIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                    <List>
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
                                    <Tooltip title="Move to analysis">
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
                </Paper>
            )}

            {/* Column 2: Analyses DataGrid (annotation columns are mock data for now) */}
            <Paper
                ref={dataGridContainerRef}
                sx={{
                    borderColor: 'divider',
                    flex: 1,
                }}
            >
                <DataGrid<IAnalysisGridRow>
                    rows={analysisGridRows}
                    columns={analysisGridColumns}
                    disableSelectionOnClick
                    hideFooter
                    disableVirtualization
                    autoHeight
                    getRowClassName={(params: GridRowClassNameParams<IAnalysisGridRow>) =>
                        params.row.rowKind === 'detail' ? 'ibma-grid-detailRow' : ''
                    }
                    onRowClick={handleAnalysisGridRowClick}
                    sx={{
                        border: 'none',
                        '& .MuiDataGrid-columnHeaders': {
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                        },
                        '& .MuiDataGrid-columnHeader.ibma-grid-analysisHeader': {
                            position: 'relative',
                            zIndex: 900,
                            bgcolor: 'background.paper',
                            borderRight: '2px solid',
                            borderColor: 'divider',
                            // Cancels ancestor translate3d(-scrollLeft) so the first column stays visually fixed.
                            transform: `translate3d(${pinnedColScrollLeft}px, 0, 0)`,
                        },
                        '& .MuiDataGrid-cell.ibma-grid-analysisCell': {
                            position: 'sticky',
                            left: 0,
                            zIndex: 4,
                            bgcolor: 'background.paper',
                            borderRight: '2px solid',
                            borderColor: 'divider',
                            alignItems: 'flex-start',
                        },
                        '& .ibma-grid-detailRow > .ibma-grid-analysisCell': {
                            maxHeight: '100% !important',
                        },
                        '& .MuiDataGrid-columnHeader.ibma-grid-annotationHeader': {
                            borderLeft: '1px solid',
                            borderColor: 'divider',
                        },
                        '& .MuiDataGrid-cell.ibma-grid-annotationCell': {
                            borderLeft: '1px solid',
                            borderColor: 'divider',
                            fontSize: '0.8125rem',
                        },
                        '& .MuiDataGrid-cell': {
                            py: 0.5,
                        },
                        '& .MuiDataGrid-row.ibma-grid-detailRow': {
                            maxHeight: '100% !important',
                        },
                    }}
                />
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
            </Paper>

            {/* Column 3: Brain map detail placeholder */}
            <Box
                sx={{
                    maxWidth: '20vw',
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

export default EditStudyAnalysisIBMA1;

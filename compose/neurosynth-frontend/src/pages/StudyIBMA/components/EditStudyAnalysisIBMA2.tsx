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
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
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
const UNCATEGORIZED_COLLAPSED_WIDTH = 40;

/** Min width for the analyses column (matches IBMA1 DataGrid minWidth ~220) */
const ANALYSES_COL_WIDTH = 220;

/** Visually hide scrollbar while keeping overflow scroll + scrollbar-gutter (left pane only). */
const hideScrollbarSx = {
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    '&::-webkit-scrollbar': {
        width: 0,
        height: 0,
        display: 'none',
    },
} as const;

const MOCK_UNCATEGORIZED_MAPS: IUncategorizedBrainMap[] = [
    { id: 'm1', name: 'contrast_001_t', mapType: 'T' },
    { id: 'm2', name: 'contrast_002_z', mapType: 'Z' },
    { id: 'm3', name: 'mask_roi', mapType: 'R' },
];

const MOCK_ANNOTATION_COLUMNS = [
    { field: 'mockAnnotationNote', headerName: 'Included', type: 'boolean' as const },
    { field: 'mockReviewer', headerName: 'Reviewer', type: 'string' as const },
    { field: 'mockQuality', headerName: 'Quality', type: 'string' as const },
    { field: 'mockNotes', headerName: 'Notes', type: 'string' as const },
    { field: 'mockTags', headerName: 'Tags', type: 'string' as const },
    { field: 'mockAuthors', headerName: 'Authors', type: 'string' as const },
    { field: 'mockPublication', headerName: 'Publication', type: 'string' as const },
    { field: 'mockStudyName', headerName: 'Study Name', type: 'string' as const },
    { field: 'mockStudyYear', headerName: 'Study Year', type: 'number' as const },
    { field: 'mockStudyPublication', headerName: 'Study Publication', type: 'string' as const },
    { field: 'mockStudyAuthors', headerName: 'Study Authors', type: 'string' as const },
    { field: 'mockStudyJournal', headerName: 'Study Journal', type: 'string' as const },
    { field: 'mockStudyVolume', headerName: 'Study Volume', type: 'number' as const },
    { field: 'mockStudyIssue', headerName: 'Study Issue', type: 'number' as const },
    { field: 'mockStudyPages', headerName: 'Study Pages', type: 'number' as const },
    { field: 'mockStudyDoi', headerName: 'Study DOI', type: 'string' as const },
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

type AnnotationFieldKey = (typeof MOCK_ANNOTATION_COLUMNS)[number]['field'];

interface IAnalysisGridRowBase {
    id: string;
    rowKind: AnalysisGridRowKind;
    name: string;
    description: string;
    parentAnalysisId?: string;
}

/** Row shape matches IBMA1: mock annotation fields spread from MOCK_ANNOTATION_VALUE_POOLS */
type IAnalysisGridRow = IAnalysisGridRowBase & Partial<Record<AnnotationFieldKey, string | boolean | number>>;

/** Shared max height so both panes scroll vertically in lockstep when content overflows */
const CENTER_TABLES_MAX_HEIGHT = 'min(560px, calc(100vh - 240px))';

/** Keeps every analysis row the same height whether the description wraps to one or two lines */
const ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX = 72;

const EditStudyAnalysisIBMA2: React.FC = () => {
    const leftScrollRef = useRef<HTMLDivElement>(null);
    /** Vertical scroll sync target (outer wrapper — not the horizontal inner). */
    const rightScrollRef = useRef<HTMLDivElement>(null);
    const scrollSyncLock = useRef(false);
    const leftBodyRef = useRef<HTMLTableSectionElement>(null);
    const rightBodyRef = useRef<HTMLTableSectionElement>(null);

    const analyses = useStudyAnalyses();
    const studyId = useStudyId();
    const addOrUpdateAnalysis = useAddOrUpdateAnalysis();
    const deleteAnalysis = useDeleteAnalysis();
    const createAnnotationNote = useCreateAnnotationNote();

    const [uncategorizedMaps, setUncategorizedMaps] = useState<IUncategorizedBrainMap[]>(() => [
        ...MOCK_UNCATEGORIZED_MAPS,
    ]);
    const [mapsByAnalysisId, setMapsByAnalysisId] = useState<Record<string, IUncategorizedBrainMap[]>>({});
    const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
    const [analysisEnabled] = useState<Record<string, boolean>>({});
    const [moveAnchorEl, setMoveAnchorEl] = useState<{ el: HTMLElement; mapId: string } | null>(null);
    const [analysisMenuAnchor, setAnalysisMenuAnchor] = useState<{ el: HTMLElement; analysis: IStoreAnalysis } | null>(
        null
    );
    const [editModalAnalysis, setEditModalAnalysis] = useState<IStoreAnalysis | null>(null);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [deleteConfirmAnalysisId, setDeleteConfirmAnalysisId] = useState<string | null>(null);
    const [uncategorizedCollapsed, setUncategorizedCollapsed] = useState(false);
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

    const syncScroll = useCallback((source: 'left' | 'right') => {
        const left = leftScrollRef.current;
        const right = rightScrollRef.current;
        if (!left || !right || scrollSyncLock.current) return;
        scrollSyncLock.current = true;
        if (source === 'left') {
            right.scrollTop = left.scrollTop;
        } else {
            left.scrollTop = right.scrollTop;
        }
        window.requestAnimationFrame(() => {
            scrollSyncLock.current = false;
        });
    }, []);

    const onLeftScroll = useCallback(() => syncScroll('left'), [syncScroll]);
    const onRightScroll = useCallback(() => syncScroll('right'), [syncScroll]);

    /** Match each left/right tbody row height so the two tables read as one grid */
    useLayoutEffect(() => {
        const leftBody = leftBodyRef.current;
        const rightBody = rightBodyRef.current;
        if (!leftBody || !rightBody) return;

        const leftRows = leftBody.querySelectorAll<HTMLTableRowElement>('tr');
        const rightRows = rightBody.querySelectorAll<HTMLTableRowElement>('tr');
        const n = Math.min(leftRows.length, rightRows.length);
        for (let i = 0; i < n; i += 1) {
            const ltr = leftRows[i];
            const rtr = rightRows[i];
            ltr.style.height = '';
            rtr.style.height = '';
            const h = Math.max(ltr.getBoundingClientRect().height, rtr.getBoundingClientRect().height);
            ltr.style.height = `${h}px`;
            rtr.style.height = `${h}px`;
        }
    }, [analysisGridRows, mapsByAnalysisId, expandedAnalysisIds, analyses]);

    const renderAnnotationCell = (row: IAnalysisGridRow, field: AnnotationFieldKey) => {
        const col = MOCK_ANNOTATION_COLUMNS.find((c) => c.field === field)!;
        if (row.rowKind === 'detail') {
            return null;
        }
        const type = col.type;
        if (type === 'boolean') {
            return <Checkbox checked={Boolean(row[field])} size="small" disabled tabIndex={-1} />;
        }
        if (type === 'string') {
            return (
                <Typography variant="body2" noWrap>
                    {row[field] as string}
                </Typography>
            );
        }
        if (type === 'number') {
            return (
                <Typography variant="body2" noWrap>
                    {row[field] as number}
                </Typography>
            );
        }
        return null;
    };

    const renderAnalysisCell = (row: IAnalysisGridRow) => {
        if (row.rowKind === 'detail') {
            const analysisId = row.parentAnalysisId!;
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
                    }}
                >
                    {maps.length === 0 ? (
                        <Typography variant="caption" sx={{ color: enabled ? 'warning.dark' : 'text.disabled' }}>
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

        const analysis = analyses.find((x) => x.id === row.id);
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
                    alignItems: 'center',
                    gap: 0.5,
                    py: 0.5,
                    width: '100%',
                    minWidth: 0,
                    minHeight: ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX,
                    boxSizing: 'border-box',
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
                        sx={{ flexShrink: 0, p: 0.25 }}
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
                <Box
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        alignSelf: 'stretch',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                    }}
                >
                    <Typography
                        variant="body2"
                        fontWeight="bold"
                        color={enabled ? (nameMissing ? 'warning.dark' : undefined) : 'text.disabled'}
                        noWrap
                        sx={{ lineHeight: 1.43 }}
                    >
                        {analysis.name || 'Untitled'}
                    </Typography>
                    <Typography
                        variant="caption"
                        component="div"
                        lineHeight={1.2}
                        color={enabled ? (descMissing ? 'warning.dark' : 'text.secondary') : 'text.disabled'}
                        sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            // Always reserve two lines so short descriptions don’t shrink the row
                            minHeight: '2.4em',
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
                    sx={{ flexShrink: 0, p: 0.25, alignSelf: 'flex-start', mt: 0.25 }}
                >
                    <MoreVertIcon fontSize="small" />
                </IconButton>
            </Box>
        );
    };

    return (
        <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
            {uncategorizedCollapsed ? (
                <Paper sx={{ width: UNCATEGORIZED_COLLAPSED_WIDTH }}>
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

            <Paper
                sx={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    overflow: 'hidden',
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'stretch',
                        minHeight: 0,
                        flex: 1,
                    }}
                >
                    {/* Left: analyses only — vertical scroll; no horizontal scroll */}
                    <TableContainer
                        ref={leftScrollRef}
                        onScroll={onLeftScroll}
                        sx={{
                            width: ANALYSES_COL_WIDTH,
                            boxSizing: 'border-box',
                            flexShrink: 0,
                            maxHeight: CENTER_TABLES_MAX_HEIGHT,
                            overflowX: 'hidden',
                            overflowY: 'auto',
                            // Reserve the same gutter the right pane uses for its vertical scrollbar (see below)
                            scrollbarGutter: 'stable',
                            borderRight: '2px solid',
                            borderColor: 'divider',
                            bgcolor: 'background.paper',
                            ...hideScrollbarSx,
                        }}
                    >
                        <Table
                            stickyHeader
                            size="small"
                            sx={{
                                tableLayout: 'fixed',
                                width: '100%',
                                borderCollapse: 'collapse',
                            }}
                        >
                            <TableHead>
                                <TableRow>
                                    <TableCell
                                        sx={{
                                            bgcolor: 'background.paper',
                                            borderBottom: 1,
                                            borderColor: 'divider',
                                            py: 1,
                                            width: '100%',
                                            maxWidth: ANALYSES_COL_WIDTH,
                                            verticalAlign: 'middle',
                                        }}
                                    >
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
                                                sx={{ fontSize: '8px' }}
                                                variant="contained"
                                                disableElevation
                                                onClick={handleCreateNewAnalysis}
                                            >
                                                <Add sx={{ fontSize: '16px' }} />
                                                Analysis
                                            </Button>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody ref={leftBodyRef}>
                                {analysisGridRows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        hover={row.rowKind === 'analysis'}
                                        onClick={
                                            row.rowKind === 'analysis'
                                                ? () => toggleAnalysisExpanded(row.id as string)
                                                : undefined
                                        }
                                        sx={{
                                            cursor: row.rowKind === 'analysis' ? 'pointer' : 'default',
                                            '& > td': {
                                                borderColor: 'divider',
                                                verticalAlign: 'top',
                                                alignItems: 'flex-start',
                                                py: 0.5,
                                            },
                                            ...(row.rowKind === 'analysis' && {
                                                '& > td': {
                                                    minHeight: ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX,
                                                    verticalAlign: 'middle',
                                                },
                                            }),
                                            ...(row.rowKind === 'detail' && {
                                                '& > td': { bgcolor: 'background.paper' },
                                            }),
                                        }}
                                    >
                                        <TableCell sx={{ borderRight: 'none' }}>{renderAnalysisCell(row)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    {/* Right: vertical scroll on outer (synced with left); horizontal scroll on inner only */}
                    <Box
                        ref={rightScrollRef}
                        onScroll={onRightScroll}
                        sx={{
                            flex: 1,
                            minWidth: 0,
                            maxHeight: CENTER_TABLES_MAX_HEIGHT,
                            overflowX: 'hidden',
                            overflowY: 'auto',
                            scrollbarGutter: 'stable',
                            bgcolor: 'background.paper',
                        }}
                    >
                        <Box sx={{ overflowX: 'auto', overflowY: 'hidden' }}>
                            <Table
                                stickyHeader
                                size="small"
                                sx={{
                                    tableLayout: 'fixed',
                                    minWidth: MOCK_ANNOTATION_COLUMNS.length * 120,
                                    borderCollapse: 'collapse',
                                }}
                            >
                                <TableHead>
                                    <TableRow>
                                        {MOCK_ANNOTATION_COLUMNS.map(({ field, headerName }) => (
                                            <TableCell
                                                key={field}
                                                sx={{
                                                    bgcolor: 'background.paper',
                                                    borderBottom: 1,
                                                    borderLeft: 1,
                                                    borderColor: 'divider',
                                                    py: 1,
                                                    fontSize: '0.8125rem',
                                                    fontWeight: 600,
                                                    minWidth: 112,
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {headerName}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody ref={rightBodyRef}>
                                    {analysisGridRows.map((row) => (
                                        <TableRow
                                            key={row.id}
                                            hover={row.rowKind === 'analysis'}
                                            onClick={
                                                row.rowKind === 'analysis'
                                                    ? () => toggleAnalysisExpanded(row.id as string)
                                                    : undefined
                                            }
                                            sx={{
                                                cursor: row.rowKind === 'analysis' ? 'pointer' : 'default',
                                                '& > td': {
                                                    borderColor: 'divider',
                                                    fontSize: '0.8125rem',
                                                    py: 0.5,
                                                    verticalAlign: 'middle',
                                                },
                                                ...(row.rowKind === 'analysis' && {
                                                    '& > td': {
                                                        minHeight: ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX,
                                                    },
                                                }),
                                                ...(row.rowKind === 'detail' && {
                                                    '& > td': {
                                                        bgcolor: 'background.paper',
                                                    },
                                                }),
                                            }}
                                        >
                                            {MOCK_ANNOTATION_COLUMNS.map(({ field }) => (
                                                <TableCell
                                                    key={field}
                                                    sx={{
                                                        borderLeft: 1,
                                                        borderColor: 'divider',
                                                    }}
                                                >
                                                    {row.rowKind === 'detail' ? (
                                                        <Box aria-hidden sx={{ display: 'block' }} />
                                                    ) : (
                                                        renderAnnotationCell(row, field)
                                                    )}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Box>
                    </Box>
                </Box>

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

export default EditStudyAnalysisIBMA2;

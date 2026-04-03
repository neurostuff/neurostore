import { Add } from '@mui/icons-material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
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
    useTheme,
} from '@mui/material';
import { alpha, type Theme } from '@mui/material/styles';
import { BarChart } from '@mui/x-charts';
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable, type Row } from '@tanstack/react-table';
import BaseDialog from 'components/Dialogs/BaseDialog';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import { useAddOrUpdateAnalysis, useDeleteAnalysis, useStudyAnalyses, useStudyId } from 'stores/study/StudyStore';
import { DefaultMapTypes } from 'stores/study/StudyStore.helpers';
import type { IStoreAnalysis } from 'stores/study/StudyStore.helpers';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCreateAnnotationNote } from 'stores/annotation/AnnotationStore.actions';
import AIICon from 'components/AIIcon';

export interface IUncategorizedBrainMap {
    id: string;
    name: string;
    mapType: keyof typeof DefaultMapTypes;
}

const NARROW_COLUMN_WIDTH = { xs: '160px', md: '300px' };
const UNCATEGORIZED_COLLAPSED_WIDTH = 40;

const ANALYSES_COL_WIDTH = 260;
const CENTER_TABLE_MAX_HEIGHT = 'min(560px, calc(100vh - 240px))';
const ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX = 72;

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
    /** Analysis rows only — avoids subscribing the whole table to expanded Set changes */
    isExpanded?: boolean;
}

type IAnalysisGridRow = IAnalysisGridRowBase & Partial<Record<AnnotationFieldKey, string | boolean | number>>;

const columnHelper = createColumnHelper<IAnalysisGridRow>();

const stickyAnalysisHeaderSx = {
    position: 'sticky',
    left: 0,
    zIndex: 4,
    bgcolor: 'background.paper',
    borderRight: 1,
    borderColor: 'divider',
    /** Explicit divider color — MUI `TableCell` head defaults can read as near-black. */
    borderBottom: (theme: Theme) => `1px solid ${theme.palette.divider}`,
};

const stickyAnalysisBodySx = {
    position: 'sticky',
    left: 0,
    zIndex: 2,
    bgcolor: 'background.paper',
    borderRight: 1,
    borderColor: 'divider',
};

function analysisGridRowsShallowEqual(a: IAnalysisGridRow, b: IAnalysisGridRow): boolean {
    if (a.rowKind !== 'analysis' || b.rowKind !== 'analysis') return false;
    if (a.id !== b.id) return false;
    if (a.isExpanded !== b.isExpanded) return false;
    if (a.name !== b.name || a.description !== b.description) return false;
    for (const { field } of MOCK_ANNOTATION_COLUMNS) {
        if (a[field] !== b[field]) return false;
    }
    return true;
}

function annotationValueToInputString(v: string | boolean | number | undefined): string {
    return v === undefined || v === null ? '' : String(v);
}

/** Borderless, transparent — reads as table cell text until focused (checkboxes unchanged elsewhere). */
const annotationInvisibleTextFieldSx = {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    '& .MuiOutlinedInput-root': {
        height: 'auto',
        alignItems: 'flex-start',
        backgroundColor: 'transparent',
        '& fieldset': { border: 'none' },
        '&:hover fieldset': { border: 'none' },
        '&.Mui-focused fieldset': { border: 'none' },
        '&.Mui-disabled fieldset': { border: 'none' },
    },
    '& .MuiOutlinedInput-notchedOutline': {
        border: 'none',
    },
    '& .MuiInputBase-input': {
        py: 0.5,
        px: 0,
        height: 'auto',
        boxSizing: 'border-box',
        typography: 'body2',
        color: 'text.primary',
        textAlign: 'left',
    },
    '& .MuiInputBase-input::placeholder': {
        color: 'text.disabled',
        opacity: 1,
    },
    '& input[type=number]': {
        MozAppearance: 'textfield',
        textAlign: 'left',
        '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
            WebkitAppearance: 'none',
            margin: 0,
        },
    },
} as const;

const annotationInvisibleMultilineTextFieldSx = {
    ...annotationInvisibleTextFieldSx,
    '& .MuiOutlinedInput-root': {
        ...annotationInvisibleTextFieldSx['& .MuiOutlinedInput-root'],
        alignItems: 'flex-start',
    },
    '& .MuiInputBase-input': {
        ...annotationInvisibleTextFieldSx['& .MuiInputBase-input'],
        height: 'auto !important',
        minHeight: 0,
        verticalAlign: 'top',
        textAlign: 'left',
    },
    '& textarea.MuiInputBase-input': {
        padding: 0,
        overflowX: 'hidden',
    },
    /** Scrollbar only while editing — `!important` overrides MUI TextareaAutosize inline `overflow`. */
    '& .MuiOutlinedInput-root:not(.Mui-focused) textarea.MuiInputBase-input': {
        overflowY: 'hidden !important',
    },
    '& .MuiOutlinedInput-root.Mui-focused textarea.MuiInputBase-input': {
        overflowY: 'auto !important',
        scrollbarGutter: 'stable',
    },
} as const;

/** Separate component so hooks are never conditional (Rules of Hooks). */
const AnnotationNumberInputCell = memo(
    function AnnotationNumberInputCell({
        rowId,
        field,
        initialValue,
        onCommit,
        fullCellSx,
    }: {
        rowId: string;
        field: AnnotationFieldKey;
        initialValue: string | boolean | number | undefined;
        onCommit: (rowId: string, field: AnnotationFieldKey, v: string | boolean | number) => void;
        fullCellSx: Record<string, unknown>;
    }) {
        const [local, setLocal] = useState(() => annotationValueToInputString(initialValue));
        useEffect(() => {
            setLocal(annotationValueToInputString(initialValue));
        }, [initialValue]);

        return (
            <Box sx={fullCellSx}>
                <TextField
                    type="number"
                    value={local}
                    onChange={(e) => setLocal(e.target.value)}
                    onBlur={() => {
                        const v = local.trim();
                        if (v === '') {
                            onCommit(rowId, field, 0);
                            return;
                        }
                        const n = Number(v);
                        if (!Number.isNaN(n)) onCommit(rowId, field, n);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    fullWidth
                    size="small"
                    variant="outlined"
                    sx={annotationInvisibleTextFieldSx}
                />
            </Box>
        );
    },
    (prev, next) => prev.rowId === next.rowId && prev.field === next.field && prev.initialValue === next.initialValue
);

const AnnotationStringInputCell = memo(
    function AnnotationStringInputCell({
        rowId,
        field,
        initialValue,
        onCommit,
        fullCellSx,
    }: {
        rowId: string;
        field: AnnotationFieldKey;
        initialValue: string | boolean | number | undefined;
        onCommit: (rowId: string, field: AnnotationFieldKey, v: string | boolean | number) => void;
        fullCellSx: Record<string, unknown>;
    }) {
        const [local, setLocal] = useState(() => annotationValueToInputString(initialValue));
        useEffect(() => {
            setLocal(annotationValueToInputString(initialValue));
        }, [initialValue]);

        const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            onCommit(rowId, field, local);
            const el = e.target as HTMLTextAreaElement;
            el.scrollTop = 0;
            el.scrollLeft = 0;
        };

        return (
            <Box sx={fullCellSx}>
                <TextField
                    value={local}
                    onChange={(e) => setLocal(e.target.value)}
                    onBlur={handleBlur}
                    onClick={(e) => e.stopPropagation()}
                    fullWidth
                    multiline
                    minRows={2}
                    maxRows={6}
                    size="small"
                    variant="outlined"
                    sx={annotationInvisibleMultilineTextFieldSx}
                />
            </Box>
        );
    },
    (prev, next) => prev.rowId === next.rowId && prev.field === next.field && prev.initialValue === next.initialValue
);

/**
 * Annotation editor — follows TanStack “editable data” pattern: local state while typing,
 * commit to parent on blur so table state (and parent re-renders) don’t run every keystroke.
 * @see https://tanstack.com/table/latest/docs/guide/editable-data
 */
const AnnotationColumnCell = memo(
    function AnnotationColumnCell({
        rowId,
        rowKind,
        field,
        type,
        initialValue,
        onCommit,
    }: {
        rowId: string;
        rowKind: AnalysisGridRowKind;
        field: AnnotationFieldKey;
        type: 'boolean' | 'string' | 'number';
        /** From row + annotationEdits — drives sync when external data changes */
        initialValue: string | boolean | number | undefined;
        onCommit: (rowId: string, field: AnnotationFieldKey, v: string | boolean | number) => void;
    }) {
        if (rowKind === 'detail') {
            return (
                <Box
                    aria-hidden
                    sx={{
                        width: '100%',
                        minHeight: ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX,
                        bgcolor: 'transparent',
                        pointerEvents: 'none',
                        userSelect: 'none',
                    }}
                />
            );
        }

        const fullCellSx = {
            width: '100%',
            minHeight: ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX,
            display: 'flex',
            flexDirection: 'column' as const,
            alignItems: 'stretch',
            justifyContent: 'flex-start',
            boxSizing: 'border-box' as const,
            p: 0.5,
        };

        if (type === 'boolean') {
            return (
                <Box sx={{ ...fullCellSx, justifyContent: 'center', alignItems: 'center' }}>
                    <Checkbox
                        checked={Boolean(initialValue)}
                        size="small"
                        onChange={(_, c) => onCommit(rowId, field, c)}
                        onClick={(e) => e.stopPropagation()}
                        inputProps={{
                            'aria-label': MOCK_ANNOTATION_COLUMNS.find((c) => c.field === field)?.headerName,
                        }}
                    />
                </Box>
            );
        }

        if (type === 'number') {
            return (
                <AnnotationNumberInputCell
                    rowId={rowId}
                    field={field}
                    initialValue={initialValue}
                    onCommit={onCommit}
                    fullCellSx={fullCellSx}
                />
            );
        }

        return (
            <AnnotationStringInputCell
                rowId={rowId}
                field={field}
                initialValue={initialValue}
                onCommit={onCommit}
                fullCellSx={fullCellSx}
            />
        );
    },
    (prev, next) =>
        prev.rowId === next.rowId &&
        prev.rowKind === next.rowKind &&
        prev.field === next.field &&
        prev.type === next.type &&
        prev.initialValue === next.initialValue
);

const EMPTY_MAPS: IUncategorizedBrainMap[] = [];

const AnalysisNameCell = memo(
    function AnalysisNameCell({
        row,
        analysis,
        mapsForParent,
        selectedMapId,
        analysisEnabled,
        onToggleExpand,
        onOpenMenu,
        onSelectMap,
        onRemoveMap,
    }: {
        row: IAnalysisGridRow;
        /** Single analysis for this row — stable reference when the analysis is unchanged (unlike the full `analyses` array). */
        analysis: IStoreAnalysis | undefined;
        mapsForParent: IUncategorizedBrainMap[];
        selectedMapId: string | null;
        analysisEnabled: Record<string, boolean>;
        onToggleExpand: (analysisId: string) => void;
        onOpenMenu: (e: React.MouseEvent<HTMLElement>, analysis: IStoreAnalysis) => void;
        onSelectMap: (mapId: string) => void;
        onRemoveMap: (analysisId: string, map: IUncategorizedBrainMap) => void;
    }) {
        if (row.rowKind === 'detail') {
            const analysisId = row.parentAnalysisId!;
            const maps = mapsForParent;
            const enabled = analysisEnabled[analysisId] !== false;
            return (
                <Box
                    sx={{
                        py: 1,
                        pl: 2,
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
                                        onSelectMap(map.id);
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
                                        onRemoveMap(analysisId, map);
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

        if (!analysis?.id) return null;
        const analysisId = analysis.id;
        const enabled = analysisEnabled[analysisId] !== false;
        const nameMissing = !analysis.name?.trim();
        const descMissing = !analysis.description?.trim();
        const expanded = row.isExpanded ?? false;
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
                            onToggleExpand(analysisId);
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
                        onOpenMenu(e, analysis);
                    }}
                    aria-label="Analysis options"
                    sx={{ flexShrink: 0, p: 0.25, alignSelf: 'flex-start', mt: 0.25 }}
                >
                    <MoreVertIcon fontSize="small" />
                </IconButton>
            </Box>
        );
    },
    (prev, next) =>
        prev.row === next.row &&
        prev.analysis === next.analysis &&
        prev.mapsForParent === next.mapsForParent &&
        prev.selectedMapId === next.selectedMapId &&
        prev.analysisEnabled === next.analysisEnabled
);

type IBMA3AnalysisTableRowProps = {
    row: Row<IAnalysisGridRow>;
    selectedMapId: string | null;
    mapsForParent: IUncategorizedBrainMap[];
    storeAnalysis: IStoreAnalysis | undefined;
    annotationEditsForRow: Partial<Record<AnnotationFieldKey, string | boolean | number>> | undefined;
    analysisEnabled: Record<string, boolean>;
    toggleAnalysisExpanded: (analysisId: string) => void;
    handleAnalysisMenuOpen: (e: React.MouseEvent<HTMLElement>, analysis: IStoreAnalysis) => void;
    setSelectedMapId: (id: string) => void;
    handleRemoveMapFromAnalysis: (analysisId: string, map: IUncategorizedBrainMap) => void;
};

function ibma3AnalysisTableRowPropsEqual(a: IBMA3AnalysisTableRowProps, b: IBMA3AnalysisTableRowProps): boolean {
    return (
        a.row.original === b.row.original &&
        a.row.id === b.row.id &&
        a.selectedMapId === b.selectedMapId &&
        a.mapsForParent === b.mapsForParent &&
        a.storeAnalysis === b.storeAnalysis &&
        a.annotationEditsForRow === b.annotationEditsForRow &&
        a.analysisEnabled === b.analysisEnabled
    );
}

/** One table row — memoized so unchanged rows skip re-render when other rows or the analyses list identity changes. */
const IBMA3AnalysisTableRow = memo(function IBMA3AnalysisTableRow({
    row,
    selectedMapId,
    mapsForParent,
    storeAnalysis,
    analysisEnabled,
    toggleAnalysisExpanded,
    handleAnalysisMenuOpen,
    setSelectedMapId,
    handleRemoveMapFromAnalysis,
}: IBMA3AnalysisTableRowProps) {
    const theme = useTheme();
    const isDetailRow = row.original.rowKind === 'detail';
    const detailRowBg = theme.palette.mode === 'light' ? theme.palette.grey[100] : alpha(theme.palette.grey[900], 0.35);

    return (
        <TableRow
            hover={row.original.rowKind === 'analysis'}
            onClick={row.original.rowKind === 'analysis' ? () => toggleAnalysisExpanded(row.original.id) : undefined}
            sx={{
                cursor: row.original.rowKind === 'analysis' ? 'pointer' : 'default',
                ...(row.original.rowKind === 'analysis' && {
                    '& > td': { minHeight: ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX },
                }),
            }}
        >
            {row.getVisibleCells().map((cell) => {
                const isAnalysis = cell.column.id === 'analysis';
                return (
                    <TableCell
                        key={cell.id}
                        sx={{
                            verticalAlign: 'top',
                            p: 0,
                            ...(isAnalysis
                                ? {
                                      ...stickyAnalysisBodySx,
                                      width: ANALYSES_COL_WIDTH,
                                      minWidth: ANALYSES_COL_WIDTH,
                                      maxWidth: ANALYSES_COL_WIDTH,
                                      ...(isDetailRow && {
                                          bgcolor: detailRowBg,
                                          borderRightColor: 'divider',
                                      }),
                                  }
                                : isDetailRow
                                  ? {
                                        borderLeft: 'none',
                                        borderBottom: 1,
                                        borderColor: 'divider',
                                        bgcolor: detailRowBg,
                                        fontSize: '0.8125rem',
                                        minWidth: 112,
                                        width: 120,
                                    }
                                  : {
                                        borderLeft: 1,
                                        borderColor: 'divider',
                                        fontSize: '0.8125rem',
                                        minWidth: 112,
                                        width: 120,
                                    }),
                        }}
                    >
                        {cell.column.id === 'analysis' ? (
                            <AnalysisNameCell
                                row={row.original}
                                analysis={storeAnalysis}
                                mapsForParent={mapsForParent}
                                selectedMapId={selectedMapId}
                                analysisEnabled={analysisEnabled}
                                onToggleExpand={toggleAnalysisExpanded}
                                onOpenMenu={handleAnalysisMenuOpen}
                                onSelectMap={setSelectedMapId}
                                onRemoveMap={handleRemoveMapFromAnalysis}
                            />
                        ) : (
                            flexRender(cell.column.columnDef.cell, cell.getContext())
                        )}
                    </TableCell>
                );
            })}
        </TableRow>
    );
}, ibma3AnalysisTableRowPropsEqual);

/** Placeholder actions — wire up when column behavior is implemented. */
const ANNOTATION_COLUMN_HEADER_MENU_ITEMS = ['Fill', 'Sort', 'Filter', 'Clear', 'Freeze column'] as const;

/** Mock histogram bins (voxel counts per intensity bin) for @mui/x-charts BarChart. */
const MOCK_VOXEL_BIN_LABELS = ['−3σ', '−2σ', '−1σ', '0', '+1σ', '+2σ', '+3σ', 'tail'];
const MOCK_VOXEL_COUNTS = [120, 340, 890, 2100, 1650, 620, 180, 45];

/** Mock “AI summary” table in the same spirit as CurationStubAITableSummary (tasks as columns). */
const MOCK_AI_SUMMARY_TASKS = ['Task 1', 'Task 2', 'Task 3'];
const MOCK_AI_SUMMARY_ROWS: { attribute: string; values: string[] }[] = [
    { attribute: 'Paradigm', values: ['Motor imagery', 'Rest', 'Localizer'] },
    { attribute: 'Contrast', values: ['Left hand > rest', 'Eyes closed', 'Faces > objects'] },
    { attribute: 'Modality', values: ['fMRI', 'fMRI', 'fMRI'] },
];

/** Mock NeuroVault-style image metadata (key / value). */
const MOCK_NEUROVAULT_IMAGE_METADATA: ReadonlyArray<{ key: string; value: string }> = [
    { key: 'analysis_level', value: 'group' },
    { key: 'brain_coverage', value: '8.178801149582592' },
    { key: 'cognitive_paradigm_cogatlas', value: 'autobiographical memory task' },
    { key: 'cognitive_paradigm_cogatlas_id', value: 'trm_4f244d2a54e27' },
    { key: 'collection', value: 'http://neurovault.org/collections/21877/' },
    { key: 'collection_id', value: '21877' },
    { key: 'data_origin', value: 'volume' },
    { key: 'file', value: 'http://neurovault.org/media/images/21877/5HT1b_thresholded.nii.nii.gz' },
    { key: 'file_size', value: '28786' },
    { key: 'id', value: '1010060' },
    { key: 'image_type', value: 'statistic_map' },
    { key: 'is_thresholded', value: 'true' },
    { key: 'is_valid', value: 'true' },
    { key: 'map_type', value: 'other' },
    { key: 'modality', value: 'Other' },
    { key: 'number_of_subjects', value: '80' },
    { key: 'perc_bad_voxels', value: '98.22311269435573' },
    { key: 'perc_voxels_outside', value: '0.26076979242724524' },
    { key: 'subject_species', value: 'homo sapiens' },
    { key: 'target_template_image', value: 'GenericMNI' },
    { key: 'url', value: 'http://neurovault.org/images/1010060/' },
];

function findBrainMapById(
    mapId: string | null,
    uncategorized: IUncategorizedBrainMap[],
    mapsByAnalysisId: Record<string, IUncategorizedBrainMap[]>
): IUncategorizedBrainMap | undefined {
    if (!mapId) return undefined;
    const u = uncategorized.find((m) => m.id === mapId);
    if (u) return u;
    for (const maps of Object.values(mapsByAnalysisId)) {
        const hit = maps.find((m) => m.id === mapId);
        if (hit) return hit;
    }
    return undefined;
}

function BrainMapDetailPanel({ map, onClose }: { map: IUncategorizedBrainMap; onClose: () => void }) {
    return (
        <Paper
            elevation={0}
            sx={{
                width: { xs: 'min(100%, 360px)', md: 360 },
                minWidth: { md: 300 },
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                p: 2,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                maxHeight: CENTER_TABLE_MAX_HEIGHT,
                overflow: 'auto',
                bgcolor: 'background.paper',
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" fontWeight="bold" noWrap title={map.name}>
                    {map.name}
                </Typography>
                <Tooltip title="Close panel">
                    <IconButton size="small" onClick={onClose} aria-label="Close map details panel">
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>

            <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.75, fontWeight: 600 }}>
                    Voxel intensity distribution
                </Typography>
                <Box sx={{ width: '100%', minHeight: 288, overflow: 'visible' }}>
                    <BarChart
                        skipAnimation
                        xAxis={[
                            {
                                id: 'bins',
                                scaleType: 'band',
                                data: MOCK_VOXEL_BIN_LABELS,
                                label: 'Bin',
                                labelStyle: { fontSize: 12 },
                            },
                        ]}
                        series={[{ data: MOCK_VOXEL_COUNTS, label: 'Voxels' }]}
                        height={280}
                        margin={{ left: 40, right: 12, top: 16, bottom: 56 }}
                    />
                </Box>
            </Box>

            <Box sx={{ mb: 2 }}>
                <Typography
                    variant="subtitle2"
                    sx={{ mb: 0.75, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}
                >
                    <AIICon />
                    Extracted Participant Demographics
                </Typography>
                <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ p: '8px', width: '28%' }}>
                                <Typography variant="body2" fontWeight="bold">
                                    Attribute
                                </Typography>
                            </TableCell>
                            {MOCK_AI_SUMMARY_TASKS.map((task, index) => (
                                <TableCell key={task} sx={{ p: '8px' }}>
                                    <Typography variant="body2">{task}</Typography>
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {MOCK_AI_SUMMARY_ROWS.map((row) => (
                            <TableRow key={row.attribute}>
                                <TableCell sx={{ p: '8px', verticalAlign: 'top' }}>
                                    <Typography variant="body2" fontWeight="bold">
                                        {row.attribute}
                                    </Typography>
                                </TableCell>
                                {row.values.map((cell, i) => (
                                    <TableCell key={i} sx={{ p: '8px', verticalAlign: 'top' }}>
                                        <Typography variant="body2">{cell}</Typography>
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Box>

            <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.75, fontWeight: 600 }}>
                    Image metadata
                </Typography>
                <Table size="small" sx={{ width: '100%' }}>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ p: '8px', width: '36%' }}>
                                <Typography variant="body2" fontWeight="bold">
                                    Field
                                </Typography>
                            </TableCell>
                            <TableCell sx={{ p: '8px' }}>
                                <Typography variant="body2" fontWeight="bold">
                                    Value
                                </Typography>
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {MOCK_NEUROVAULT_IMAGE_METADATA.map((row) => (
                            <TableRow key={row.key}>
                                <TableCell sx={{ p: '8px', verticalAlign: 'top' }}>
                                    <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                                        {row.key}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={{ p: '8px', verticalAlign: 'top' }}>
                                    <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                                        {row.value}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Box>
        </Paper>
    );
}

const AnnotationColumnHeaderWithMenu = memo(function AnnotationColumnHeaderWithMenu({
    headerName,
}: {
    headerName: string;
}) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const handleClose = () => setAnchorEl(null);

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 0.25,
                width: '100%',
                minWidth: 0,
            }}
        >
            <Typography
                variant="subtitle2"
                sx={{ fontSize: '0.8125rem', fontWeight: 600, flex: 1, minWidth: 0 }}
                noWrap
                title={headerName}
            >
                {headerName}
            </Typography>
            <Tooltip title="Column options">
                <IconButton
                    size="small"
                    aria-label={`${headerName} column options`}
                    aria-haspopup="true"
                    aria-expanded={open ? 'true' : 'false'}
                    onClick={(e) => {
                        e.stopPropagation();
                        setAnchorEl(e.currentTarget);
                    }}
                    sx={{ flexShrink: 0, p: 0.25 }}
                >
                    <MoreVertIcon sx={{ fontSize: '1.125rem' }} />
                </IconButton>
            </Tooltip>
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                onClick={(e) => e.stopPropagation()}
            >
                {ANNOTATION_COLUMN_HEADER_MENU_ITEMS.map((label) => (
                    <MenuItem key={label} dense onClick={handleClose}>
                        {label}
                    </MenuItem>
                ))}
            </Menu>
        </Box>
    );
});

const EditStudyAnalysisIBMA3: React.FC = () => {
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
    const toggleMapSelection = useCallback((mapId: string) => {
        setSelectedMapId((prev) => (prev === mapId ? null : mapId));
    }, []);
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

    /** Local overrides for editable annotation cells (keyed by row id) */
    const [annotationEdits, setAnnotationEdits] = useState<
        Record<string, Partial<Record<AnnotationFieldKey, string | boolean | number>>>
    >({});
    const annotationEditsRef = useRef(annotationEdits);
    annotationEditsRef.current = annotationEdits;

    /** Stable reads so column defs / parents don’t churn when edits change */
    const getAnnotationDisplayValue = useCallback(
        (row: IAnalysisGridRow, field: AnnotationFieldKey): string | boolean | number | undefined => {
            if (row.rowKind === 'detail') return undefined;
            return annotationEditsRef.current[row.id]?.[field] ?? row[field];
        },
        []
    );

    const setAnnotationDisplayValue = useCallback(
        (rowId: string, field: AnnotationFieldKey, value: string | boolean | number) => {
            setAnnotationEdits((prev) => ({
                ...prev,
                [rowId]: { ...prev[rowId], [field]: value },
            }));
        },
        []
    );

    /** Stable callback identity for memoized annotation cells */
    const setAnnotationRef = useRef(setAnnotationDisplayValue);
    setAnnotationRef.current = setAnnotationDisplayValue;
    const commitAnnotation = useCallback(
        (rowId: string, field: AnnotationFieldKey, value: string | boolean | number) => {
            setAnnotationRef.current(rowId, field, value);
        },
        []
    );

    const toggleAnalysisExpanded = useCallback((analysisId: string) => {
        setExpandedAnalysisIds((prev) => {
            const next = new Set(prev);
            if (next.has(analysisId)) next.delete(analysisId);
            else next.add(analysisId);
            return next;
        });
    }, []);

    const prevTableRowsRef = useRef<IAnalysisGridRow[]>([]);

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

    const selectedBrainMap = useMemo(
        () => (selectedMapId ? findBrainMapById(selectedMapId, uncategorizedMaps, mapsByAnalysisId) : undefined),
        [selectedMapId, uncategorizedMaps, mapsByAnalysisId]
    );

    const tableData = useMemo((): IAnalysisGridRow[] => {
        const prevById = new Map(prevTableRowsRef.current.map((r) => [r.id, r]));
        const rows: IAnalysisGridRow[] = [];

        analyses.forEach((a, idx) => {
            const id = a.id!;
            const mockEntries = MOCK_ANNOTATION_COLUMNS.map(({ field }) => {
                const pool = MOCK_ANNOTATION_VALUE_POOLS[field];
                return [field, pool[idx % pool.length]] as const;
            });
            const expanded = expandedAnalysisIds.has(id);
            const candidate: IAnalysisGridRow = {
                id,
                rowKind: 'analysis',
                isExpanded: expanded,
                name: a.name ?? '',
                description: a.description ?? '',
                ...Object.fromEntries(mockEntries),
            };
            const old = prevById.get(id);
            if (old && old.rowKind === 'analysis' && analysisGridRowsShallowEqual(old, candidate)) {
                rows.push(old);
            } else {
                rows.push(candidate);
            }

            if (expanded) {
                const detailId = `${id}${BRAIN_MAPS_DETAIL_ROW_SUFFIX}`;
                const detailCandidate: IAnalysisGridRow = {
                    id: detailId,
                    rowKind: 'detail',
                    parentAnalysisId: id,
                    name: '',
                    description: '',
                };
                const oldDetail = prevById.get(detailId);
                if (oldDetail && oldDetail.rowKind === 'detail') {
                    rows.push(oldDetail);
                } else {
                    rows.push(detailCandidate);
                }
            }
        });

        prevTableRowsRef.current = rows;
        return rows;
    }, [analyses, expandedAnalysisIds]);

    const columns = useMemo(
        () => [
            columnHelper.display({
                id: 'analysis',
                header: () => (
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 0.5,
                            minWidth: ANALYSES_COL_WIDTH - 24,
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
                /** Body cells render in `IBMA3AnalysisTableRow` so rows can be memoized without duplicating `analyses` identity. */
                cell: () => null,
                size: ANALYSES_COL_WIDTH,
            }),
            ...MOCK_ANNOTATION_COLUMNS.map((col) =>
                columnHelper.display({
                    id: col.field,
                    header: () => <AnnotationColumnHeaderWithMenu headerName={col.headerName} />,
                    cell: (info) => {
                        const row = info.row.original;
                        const value = getAnnotationDisplayValue(row, col.field);
                        return (
                            <AnnotationColumnCell
                                rowId={row.id}
                                rowKind={row.rowKind}
                                field={col.field}
                                type={col.type}
                                initialValue={value}
                                onCommit={commitAnnotation}
                            />
                        );
                    },
                    size: 120,
                    minSize: 112,
                })
            ),
        ],
        [commitAnnotation, getAnnotationDisplayValue, handleCreateNewAnalysis]
    );

    const table = useReactTable({
        data: tableData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row) => row.id,
    });

    const tableMinWidth = ANALYSES_COL_WIDTH + MOCK_ANNOTATION_COLUMNS.length * 112;

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
                                    onClick={() => toggleMapSelection(map.id)}
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
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    overflow: 'hidden',
                }}
            >
                <TableContainer
                    sx={{
                        maxHeight: CENTER_TABLE_MAX_HEIGHT,
                        overflow: 'auto',
                        bgcolor: 'background.paper',
                    }}
                >
                    <Table
                        stickyHeader
                        size="small"
                        sx={{
                            minWidth: tableMinWidth,
                            borderCollapse: 'separate',
                            borderSpacing: 0,
                            tableLayout: 'fixed',
                        }}
                    >
                        <TableHead>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => {
                                        const isAnalysis = header.column.id === 'analysis';
                                        return (
                                            <TableCell
                                                key={header.id}
                                                sx={{
                                                    py: 1,
                                                    ...(isAnalysis
                                                        ? {
                                                              ...stickyAnalysisHeaderSx,
                                                              width: ANALYSES_COL_WIDTH,
                                                              minWidth: ANALYSES_COL_WIDTH,
                                                              maxWidth: ANALYSES_COL_WIDTH,
                                                          }
                                                        : {
                                                              bgcolor: 'background.paper',
                                                              borderBottom: 1,
                                                              borderLeft: 1,
                                                              borderColor: 'divider',
                                                              minWidth: 112,
                                                              width: 120,
                                                          }),
                                                }}
                                            >
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(header.column.columnDef.header, header.getContext())}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableHead>
                        <TableBody>
                            {table.getRowModel().rows.map((row) => {
                                const orig = row.original;
                                const mapsForParent = orig.parentAnalysisId
                                    ? (mapsByAnalysisId[orig.parentAnalysisId] ?? EMPTY_MAPS)
                                    : EMPTY_MAPS;
                                const storeAnalysis =
                                    orig.rowKind === 'analysis' ? analyses.find((a) => a.id === orig.id) : undefined;
                                return (
                                    <IBMA3AnalysisTableRow
                                        key={row.id}
                                        row={row}
                                        selectedMapId={selectedMapId}
                                        mapsForParent={mapsForParent}
                                        storeAnalysis={storeAnalysis}
                                        annotationEditsForRow={annotationEdits[orig.id]}
                                        analysisEnabled={analysisEnabled}
                                        toggleAnalysisExpanded={toggleAnalysisExpanded}
                                        handleAnalysisMenuOpen={handleAnalysisMenuOpen}
                                        setSelectedMapId={toggleMapSelection}
                                        handleRemoveMapFromAnalysis={handleRemoveMapFromAnalysis}
                                    />
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>

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

            {selectedBrainMap ? (
                <BrainMapDetailPanel map={selectedBrainMap} onClose={() => setSelectedMapId(null)} />
            ) : null}

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

export default EditStudyAnalysisIBMA3;

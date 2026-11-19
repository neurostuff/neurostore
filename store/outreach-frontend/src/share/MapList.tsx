import { alpha, type Theme } from '@mui/material/styles';
import {
    Alert,
    Box,
    Chip,
    CircularProgress,
    IconButton,
    Link,
    MenuItem,
    Paper,
    Select,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FolderIcon from '@mui/icons-material/Folder';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { useState, type MouseEvent, type ReactNode } from 'react';
import type { Group } from './grouping';
import { FITS, formatBytes, parentFolder, prompts, shownPath, TYPE_LABELS } from './review';
import { MAP_TYPES, type MapType, type ShareUpload, type ShareView } from './types';

/** For a map left in the pool: the paper may not table it, so the author can say what it is. */
function LabelField({
    upload,
    disabled,
    onLabel,
}: {
    upload: ShareUpload;
    disabled: boolean;
    onLabel: (label: string) => void;
}) {
    const [label, setLabel] = useState(upload.label ?? '');
    return (
        <TextField
            size="small"
            fullWidth
            label="What is this map? (for maps the paper does not table)"
            value={label}
            autoFocus={!upload.label}
            disabled={disabled}
            onChange={(event) => setLabel(event.target.value)}
            onBlur={() => label !== (upload.label ?? '') && onLabel(label)}
            sx={{
                bgcolor: 'background.paper',
                // The label and the input root share one font size, so the outline's gap
                // (sized from the root's font at 0.75x) matches the shrunk label.
                '& .MuiInputBase-root': { fontSize: '0.8rem' },
                '& .MuiInputBase-input': { py: 1, px: 1.25 },
                '& .MuiInputLabel-root': { fontSize: '0.8rem' },
                '& .MuiInputLabel-root:not(.MuiInputLabel-shrink)': { transform: 'translate(10px, 8px)' },
                '& .MuiInputLabel-shrink': { transform: 'translate(14px, -7px) scale(0.75)' },
            }}
        />
    );
}

/** The colour of a map's kind, so the same kinds look alike everywhere: statistic maps (t, z, F)
 * are primary, the effect and variance maps that attach to them secondary, anything else grey. */
function kindColor(theme: Theme, type: MapType | null) {
    if (type === 't' || type === 'z' || type === 'f') return theme.palette.primary.main;
    if (type === 'effect' || type === 'variance') return theme.palette.secondary.main;
    return theme.palette.grey[600];
}

/** What every row of one list has in common. */
interface Shared {
    from: string | null;
    view: ShareView;
    folder: string;
    disabled: boolean;
    loadingId: string | null;
    notes: ReturnType<typeof prompts>;
    onMenu: (event: MouseEvent<HTMLElement>, upload: ShareUpload, group: Group | null, from: string | null) => void;
    onKind: (id: string, type: MapType) => void;
    onRemoveFile: (id: string) => void;
    /** Take a group off the analysis it is on. */
    onUnassign: (group: Group, from: string) => void;
    /** Take an effect or variance map off its t/z map, back to the pool. */
    onDetach: (upload: ShareUpload) => void;
    onLabel: (id: string, label: string) => void;
    /** Maps whose description field the author asked for. */
    describing: Set<string>;
    /** The author says the paper does not table this map: its description field shows. */
    onDescribe: (id: string) => void;
}

function MapRow({
    upload,
    group,
    addressed,
    shared,
    children,
}: {
    upload: ShareUpload;
    group: Group | null;
    /** On an analysis or described: outlined in green. */
    addressed: boolean;
    shared: Shared;
    /** The effect and variance maps that go with this t/z map, shown inside its card. */
    children?: ReactNode;
}) {
    const {
        from,
        folder,
        disabled,
        loadingId,
        notes,
        onMenu,
        onKind,
        onRemoveFile,
        onUnassign,
        onDetach,
        onLabel,
        describing,
        onDescribe,
    } = shared;
    // What the last button does. A map on an analysis comes off it, and an effect or variance map
    // inside any card, on an analysis or in the pool, comes off its t/z map. Only a t/z or lone
    // map in the pool is deleted.
    const action = group === null ? 'detach' : from === null ? 'delete' : 'unassign';
    const path = shownPath(upload, folder);
    const inside = parentFolder(upload);
    const fit = from && group ? upload.fits[from] : null;
    const about = notes.filter(
        (note) =>
            note.uploadId === upload.id &&
            (note.analysisKey === undefined || note.analysisKey === from) &&
            !(from === null && note.unplaced),
    );
    const suggested = group && from && upload.assigned_by === 'suggestion';
    // A map with no group is an effect or variance map, drawn inside its t/z map's card.
    const nested = group === null;
    // The filename of an effect or variance map is painted in a darker shade of its kind's colour.
    const attachable = upload.map_type === 'effect' || upload.map_type === 'variance';
    return (
        <Paper
            // A nested map is flat, in a grey a little lighter than its parent's.
            variant={nested ? 'elevation' : 'outlined'}
            elevation={0}
            sx={{
                p: nested ? 1 : 1.5,
                width: '100%',
                bgcolor: nested
                    ? 'grey.50'
                    : addressed
                      ? (theme) => alpha(theme.palette.success.main, 0.08)
                      : 'grey.100',
                ...(addressed && !nested ? { borderColor: 'success.main' } : {}),
                // A soft accent bar on the left of an effect or variance map, nested or not.
                ...(nested || attachable
                    ? {
                          borderLeft: 3,
                          borderLeftStyle: 'solid',
                          borderLeftColor: (theme: Theme) => alpha(kindColor(theme, upload.map_type), 0.5),
                          borderRadius: '0 4px 4px 0',
                      }
                    : {}),
            }}
        >
            <Stack>
                <Stack direction="row" alignItems="center">
                    <Select
                        size="small"
                        value={upload.map_type ?? 'other'}
                        disabled={disabled}
                        onChange={(event) => onKind(upload.id, event.target.value as MapType)}
                        SelectDisplayProps={{ 'aria-label': `Kind of map for ${path}` }}
                        sx={{
                            flexShrink: 0,
                            // Coloured like a chip by kind: the select stays so a wrong kind can be fixed.
                            bgcolor: (theme) => alpha(kindColor(theme, upload.map_type), 0.12),
                            color: (theme) => kindColor(theme, upload.map_type),
                            fontSize: 13,
                            fontWeight: 600,
                            '& .MuiSelect-select': { py: 0.5, pl: 1 },
                            '& .MuiSelect-icon': { color: 'inherit' },
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: (theme) => alpha(kindColor(theme, upload.map_type), 0.5),
                            },
                        }}
                    >
                        {MAP_TYPES.map((type) => (
                            <MenuItem key={type} value={type}>
                                {TYPE_LABELS[type]}
                            </MenuItem>
                        ))}
                    </Select>
                    <Box sx={{ minWidth: 0, flexGrow: 1, mx: 1 }}>
                        <Typography
                            variant="subtitle2"
                            title={upload.path ?? upload.filename}
                            sx={{
                                ...(attachable ? { color: 'secondary.dark' } : {}),
                                overflowWrap: 'anywhere',
                                fontSize: "0.75rem",
                                display: '-webkit-box',
                                WebkitBoxOrient: 'vertical',
                                WebkitLineClamp: 2,
                                overflow: 'hidden',
                                lineHeight: "normal"
                            }}
                        >
                            {upload.filename}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.2 }}>
                            {formatBytes(upload.size_bytes)}
                        </Typography>
                    </Box>
                    {loadingId === upload.id ? (
                        <Box sx={{ width: 34, height: 34, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
                            <CircularProgress size={18} aria-label="Moving" />
                        </Box>
                    ) : (
                        // The span lets the tooltip show on a disabled button too.
                        <Tooltip title="Assign this map">
                            <span style={{ flexShrink: 0 }}>
                                <IconButton
                                    aria-label={`Options for ${path}`}
                                    aria-haspopup="menu"
                                    disabled={disabled}
                                    onClick={(event) => onMenu(event, upload, group, from)}
                                    sx={{ width: 34, height: 34 }}
                                >
                                    <SwapHorizIcon fontSize="small" />
                                </IconButton>
                            </span>
                        </Tooltip>
                    )}
                    <Tooltip
                        title={
                            action === 'unassign'
                                ? 'Unassign from analysis'
                                : action === 'detach'
                                  ? 'Unassign from parent'
                                  : 'Delete this map'
                        }
                    >
                        <span style={{ flexShrink: 0 }}>
                            <IconButton
                                aria-label={
                                    action === 'unassign'
                                        ? `Unassign ${path}`
                                        : action === 'detach'
                                          ? `Unassign ${path} from its t/z map`
                                          : `Remove ${path}`
                                }
                                color={action === 'delete' ? 'error' : 'default'}
                                disabled={disabled || loadingId === upload.id}
                                onClick={() => {
                                    if (action === 'unassign' && group && from) onUnassign(group, from);
                                    else if (action === 'detach') onDetach(upload);
                                    else onRemoveFile(upload.id);
                                }}
                                sx={{ width: 34, height: 34 }}
                            >
                                {action === 'unassign' ? (
                                    <LinkOffIcon fontSize="small" />
                                ) : action === 'detach' ? (
                                    <RemoveCircleOutlineIcon fontSize="small" />
                                ) : (
                                    <DeleteOutlineIcon fontSize="small" />
                                )}
                            </IconButton>
                        </span>
                    </Tooltip>
                </Stack>
                {inside && (
                    <Stack direction="row" spacing={0.75} alignItems="center" title={upload.path ?? undefined}>
                        <FolderIcon sx={{ color: 'text.secondary', fontSize: '16px' }} />
                        <Typography variant="caption" color="text.secondary" noWrap>
                            {inside}
                        </Typography>
                    </Stack>
                )}
                {from === null &&
                    group &&
                    upload.kind !== 'variance' &&
                    // A link until the author says the paper does not table this map; then its field.
                    (describing.has(upload.id) || (upload.label ?? '') !== '' ? (
                        <Box sx={{ mt: 1, width: '100%' }}>
                            <LabelField
                                key={`${upload.id}-${upload.label ?? ''}`}
                                upload={upload}
                                disabled={disabled}
                                onLabel={(label) => onLabel(upload.id, label)}
                            />
                        </Box>
                    ) : (
                        <Box>
                            <Link
                                component="button"
                                type="button"
                                variant="caption"
                                disabled={disabled}
                                onClick={() => onDescribe(upload.id)}
                            >
                                Not reported in the paper's tables
                            </Link>
                        </Box>
                    ))}
                {((fit && upload.kind !== 'variance') || suggested) && (
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {fit && upload.kind !== 'variance' && (
                            <Chip size="small" color={FITS[fit.outcome].tone} label={FITS[fit.outcome].label} />
                        )}
                        {suggested && <Chip size="small" variant="outlined" label="suggested" />}
                    </Stack>
                )}
                {about.map((note) => (
                    <Alert
                        key={note.text}
                        severity={note.tone}
                        sx={{
                            py: 0,
                            px: 1,
                            mt: 1,
                            fontSize: '0.75rem',
                            '& .MuiAlert-icon': { fontSize: 16, py: 0.75, mr: 1 },
                            '& .MuiAlert-message': { py: 0.75 },
                        }}
                    >
                        {note.body ?? note.text}
                    </Alert>
                ))}
                {children && (
                    <Stack spacing={1} sx={{ mt: 1 }}>
                        {children}
                    </Stack>
                )}
            </Stack>
        </Paper>
    );
}

/** The groups on one analysis (``from``), or in the pool (null). Each is a t/z map with
 * its effect and variance maps inside its card; only the t/z map is moved, and the
 * others go with it. */
export function MapList({
    groups,
    from,
    view,
    folder,
    disabled,
    loadingId,
    onMenu,
    onKind,
    onRemoveFile,
    onUnassign,
    onDetach,
    onLabel,
    describing,
    onDescribe,
}: {
    groups: Group[];
    from: string | null;
    view: ShareView;
    /** The folder every upload sits in, left off each row's path. */
    folder: string;
    disabled: boolean;
    /** The map whose move is going through. */
    loadingId: string | null;
    onMenu: Shared['onMenu'];
    onKind: Shared['onKind'];
    onRemoveFile: Shared['onRemoveFile'];
    onUnassign: Shared['onUnassign'];
    onDetach: Shared['onDetach'];
    onLabel: Shared['onLabel'];
    describing: Shared['describing'];
    onDescribe: Shared['onDescribe'];
}) {
    const shared: Shared = {
        from,
        view,
        folder,
        disabled,
        loadingId,
        notes: prompts(view),
        onMenu,
        onKind,
        onRemoveFile,
        onUnassign,
        onDetach,
        onLabel,
        describing,
        onDescribe,
    };

    return (
        <Stack spacing={1}>
            {groups.map((group) => {
                const addressed = from !== null || (group.lead.label ?? '').trim() !== '';
                return (
                    <Box key={group.lead.id}>
                        <MapRow upload={group.lead} group={group} addressed={addressed} shared={shared}>
                            {group.members.map((member) => (
                                <MapRow
                                    key={member.id}
                                    upload={member}
                                    group={null}
                                    addressed={addressed}
                                    shared={shared}
                                />
                            ))}
                        </MapRow>
                    </Box>
                );
            })}
        </Stack>
    );
}

import { alpha } from '@mui/material/styles';
import { Alert, Box, Chip, CircularProgress, IconButton, MenuItem, Paper, Select, Stack, TextField, Tooltip, Typography } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useState, type MouseEvent } from 'react';
import type { Group } from './grouping';
import { FITS, formatBytes, prompts, shownPath, TYPE_LABELS } from './review';
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
            label="What is this map? (for maps the paper does not table)"
            value={label}
            autoFocus={!upload.label}
            disabled={disabled}
            onChange={(event) => setLabel(event.target.value)}
            onBlur={() => label !== (upload.label ?? '') && onLabel(label)}
            sx={{ bgcolor: 'background.paper' }}
        />
    );
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
    onLabel: (id: string, label: string) => void;
    /** Maps whose description field the author asked for. */
    describing: Set<string>;
}

function MapRow({
    upload,
    group,
    addressed,
    shared,
}: {
    upload: ShareUpload;
    group: Group | null;
    /** On an analysis or described: outlined in green. */
    addressed: boolean;
    shared: Shared;
}) {
    const { from, folder, disabled, loadingId, notes, onMenu, onKind, onRemoveFile, onLabel, describing } = shared;
    const path = shownPath(upload, folder);
    const fit = from && group ? upload.fits[from] : null;
    const about = notes.filter(
        (note) =>
            note.uploadId === upload.id &&
            (note.analysisKey === undefined || note.analysisKey === from) &&
            !(from === null && note.unplaced)
    );
    const suggested = group && from && upload.assigned_by === 'suggestion';
    return (
        <Paper
            variant="outlined"
            // Stack resets its children's margins, so the indent of a set's maps is inline.
            style={group ? undefined : { marginLeft: 24 }}
            sx={{
                p: 1.5,
                width: group ? '100%' : 'calc(100% - 24px)',
                bgcolor: addressed ? (theme) => alpha(theme.palette.success.main, 0.08) : 'grey.100',
                ...(addressed ? { borderColor: 'success.main' } : {}),
                ...(group ? {} : { borderLeft: 3, borderLeftColor: addressed ? 'success.main' : 'primary.light' }),
            }}
        >
            <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Select
                        size="small"
                        value={upload.map_type ?? 'other'}
                        disabled={disabled}
                        onChange={(event) => onKind(upload.id, event.target.value as MapType)}
                        SelectDisplayProps={{ 'aria-label': `Kind of map for ${path}` }}
                        sx={{ flexShrink: 0, bgcolor: 'background.paper' }}
                    >
                        {MAP_TYPES.map((type) => (
                            <MenuItem key={type} value={type}>
                                {TYPE_LABELS[type]}
                            </MenuItem>
                        ))}
                    </Select>
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Typography
                            variant="subtitle2"
                            title={path}
                            sx={{
                                overflowWrap: 'anywhere',
                                display: '-webkit-box',
                                WebkitBoxOrient: 'vertical',
                                WebkitLineClamp: 2,
                                overflow: 'hidden',
                            }}
                        >
                            {path}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
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
                                    ⋯
                                </IconButton>
                            </span>
                        </Tooltip>
                    )}
                    <Tooltip title="Delete this map">
                        <span style={{ flexShrink: 0 }}>
                            <IconButton
                                aria-label={`Remove ${path}`}
                                color="error"
                                disabled={disabled || loadingId === upload.id}
                                onClick={() => onRemoveFile(upload.id)}
                                sx={{ width: 34, height: 34 }}
                            >
                                <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Stack>
                {from === null &&
                    group &&
                    upload.kind !== 'variance' &&
                    (describing.has(upload.id) || (upload.label ?? '') !== '') && (
                    <LabelField
                        key={`${upload.id}-${upload.label ?? ''}`}
                        upload={upload}
                        disabled={disabled}
                        onLabel={(label) => onLabel(upload.id, label)}
                    />
                )}
                {((fit && upload.kind !== 'variance') || suggested) && (
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {fit && upload.kind !== 'variance' && (
                            <Chip size="small" color={FITS[fit.outcome].tone} label={FITS[fit.outcome].label} />
                        )}
                        {suggested && <Chip size="small" variant="outlined" label="suggested" />}
                    </Stack>
                )}
                {about.map((note) => (
                    <Alert key={note.text} severity={note.tone} sx={{ py: 0 }}>
                        {note.text}
                    </Alert>
                ))}
            </Stack>
        </Paper>
    );
}

/** The groups on one analysis (``from``), or in the pool (null). Each is a t/z map with
 * its effect and variance maps indented under it; only the t/z map is moved, and the
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
    onLabel,
    describing,
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
    onLabel: Shared['onLabel'];
    describing: Shared['describing'];
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
        onLabel,
        describing,
    };

    return (
        <Stack spacing={1}>
            {groups.map((group) => {
                const addressed = from !== null || (group.lead.label ?? '').trim() !== '';
                return (
                    <Box key={group.lead.id}>
                        <Stack spacing={1}>
                            <MapRow upload={group.lead} group={group} addressed={addressed} shared={shared} />
                            {group.members.map((member) => (
                                <MapRow
                                    key={member.id}
                                    upload={member}
                                    group={null}
                                    addressed={addressed}
                                    shared={shared}
                                />
                            ))}
                        </Stack>
                    </Box>
                );
            })}
        </Stack>
    );
}

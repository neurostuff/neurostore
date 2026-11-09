import FolderIcon from '@mui/icons-material/Folder';
import { Box, Button, Checkbox, Chip, FormControlLabel, ListItemButton, Stack, Typography } from '@mui/material';
import { memo } from 'react';
import { CHOSEN_FOLDER, FOLDER_COLOUR, formatBytes, inFolder, TYPE_LABELS } from './review';
import type { Candidate } from './tree';

const fileName = (path: string) => path.split('/').pop() ?? path;
const folderName = (path: string) => path.split('/').slice(0, -1).join('/');

function TypeChip({ candidate }: { candidate: Candidate }) {
    return (
        <Chip
            size="small"
            label={TYPE_LABELS[candidate.kind] ?? candidate.kind}
            sx={{ height: 18, fontSize: '0.7rem', '& .MuiChip-label': { px: 0.75 } }}
        />
    );
}

/** The size, and why the map was left out when that tells the author something: that it
 * is over the limit is not worth saying. */
function SizeLine({ candidate, withReason = false }: { candidate: Candidate; withReason?: boolean }) {
    const reason = withReason && candidate.note !== 'over the limit' ? candidate.note : null;
    return (
        <Typography variant="caption" color="text.secondary" display="block">
            {formatBytes(candidate.file.size)}
            {reason && (
                <>
                    {' · '}
                    <Box component="span" sx={{ color: 'warning.dark' }}>
                        {reason}
                    </Box>
                </>
            )}
        </Typography>
    );
}

/** One map as the panel and the swap list show it: its folder, then what it is and its file
 * name, then its size. */
function MapSummary({ candidate, folder }: { candidate: Candidate; folder: string }) {
    return (
        <Box sx={{ pt: 0.5, minWidth: 0 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
                <FolderIcon sx={{ fontSize: 14, color: FOLDER_COLOUR }} />
                <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                    {folderName(inFolder(candidate.path, folder)) || CHOSEN_FOLDER}
                </Typography>
            </Stack>
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                <TypeChip candidate={candidate} />
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                    {fileName(candidate.path)}
                </Typography>
            </Stack>
            <SizeLine candidate={candidate} />
        </Box>
    );
}

/** A map in its folder's list, selected or not: what it is, its file name, its size. Memoized
 * on what it shows, so ticking one map does not draw the rest of a long list again. */
export const MapRow = memo(function MapRow({
    candidate,
    checked,
    onToggle,
}: {
    candidate: Candidate;
    checked: boolean;
    onToggle: (path: string) => void;
}) {
    return (
        <FormControlLabel
            sx={{ alignItems: 'flex-start', display: 'flex', m: 0 }}
            control={<Checkbox size="small" checked={checked} onChange={() => onToggle(candidate.path)} />}
            label={
                <Box sx={{ pt: 0.5, minWidth: 0 }}>
                    <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                        <TypeChip candidate={candidate} />
                        <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                            {fileName(candidate.path)}
                        </Typography>
                    </Stack>
                    <SizeLine candidate={candidate} withReason />
                </Box>
            }
        />
    );
});

/** A selected map in the panel: its folder, what it is and its file name, its size, and a
 * button to swap it for a similar map. */
export const SelectedMapRow = memo(function SelectedMapRow({
    candidate,
    folder,
    canSwap,
    onToggle,
    onSwap,
}: {
    candidate: Candidate;
    /** The folder every path shares, left off the row's path. */
    folder: string;
    canSwap: boolean;
    onToggle: (path: string) => void;
    onSwap: (button: HTMLElement, from: Candidate) => void;
}) {
    const relative = inFolder(candidate.path, folder);
    return (
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <FormControlLabel
                sx={{ alignItems: 'flex-start', minWidth: 0, m: 0 }}
                control={<Checkbox size="small" checked onChange={() => onToggle(candidate.path)} />}
                label={<MapSummary candidate={candidate} folder={folder} />}
            />
            {canSwap && (
                <Button
                    size="small"
                    sx={{ flexShrink: 0 }}
                    aria-haspopup="dialog"
                    aria-label={`Swap ${relative} for a similar map`}
                    onClick={(event) => onSwap(event.currentTarget, candidate)}
                >
                    Swap
                </Button>
            )}
        </Stack>
    );
});

/** One folder's heading and its maps. Redrawn only when the folder's own maps change or are
 * ticked, not when a map in another folder is, so a long list of folders stays still. */
export const FolderGroup = memo(
    function FolderGroup({
        folder,
        maps,
        heading,
        selected,
        onToggle,
    }: {
        /** The folder's name, empty for the one the author chose. */
        folder: string;
        maps: Candidate[];
        heading: boolean;
        selected: ReadonlySet<string>;
        onToggle: (path: string) => void;
    }) {
        return (
            <Box component="section">
                {heading && (
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.25 }}>
                        <FolderIcon fontSize="small" sx={{ color: FOLDER_COLOUR }} />
                        <Typography variant="body2" component="h3" sx={{ fontWeight: 400, overflowWrap: 'anywhere' }}>
                            {folder || CHOSEN_FOLDER}{' '}
                            <Box component="span" sx={{ color: 'text.secondary' }}>
                                ({maps.length})
                            </Box>
                        </Typography>
                    </Stack>
                )}
                <Stack sx={{ pl: 1 }}>
                    {maps.map((candidate) => (
                        <MapRow
                            key={candidate.path}
                            candidate={candidate}
                            checked={selected.has(candidate.path)}
                            onToggle={onToggle}
                        />
                    ))}
                </Stack>
            </Box>
        );
    },
    (before, after) =>
        before.folder === after.folder &&
        before.maps === after.maps &&
        before.heading === after.heading &&
        before.onToggle === after.onToggle &&
        // Only this folder's maps matter: ticking one elsewhere changes the set but not these.
        after.maps.every((map) => before.selected.has(map.path) === after.selected.has(map.path))
);

/** One map to swap in, shaped like the rows of the panel. */
export const SwapOption = memo(function SwapOption({
    candidate,
    folder,
    onPick,
}: {
    candidate: Candidate;
    folder: string;
    onPick: (candidate: Candidate) => void;
}) {
    return (
        <ListItemButton
            dense
            aria-label={inFolder(candidate.path, folder)}
            onClick={() => onPick(candidate)}
            sx={{ alignItems: 'flex-start', py: 0.25 }}
        >
            <MapSummary candidate={candidate} folder={folder} />
        </ListItemButton>
    );
});

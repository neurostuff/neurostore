import { Box, Button, List, Popover, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { MapFilters } from './MapFilters';
import { SwapOption } from './MapRow';
import { filterCandidates, groupByFolder, similarMaps, type Candidate, type GuessedKind } from './tree';

const SWAP_TITLE = 'Swap this with a similar map';
/** A long list of options slows the page, so it opens with this many and adds more on request. */
const FIRST_OPTIONS = 100;
const MORE_OPTIONS = 50;

/** The maps the author might have meant instead of ``from``, nearest first, a hundred at a
 * time, with the same search and filters as the list of maps. Opens when asked and is thrown away on
 * close, so its filters start empty each time. */
export function SwapPicker({
    anchor,
    from,
    candidates,
    selected,
    folder,
    onPick,
    onClose,
}: {
    anchor: HTMLElement;
    from: Candidate;
    candidates: Candidate[];
    selected: Set<string>;
    /** The folder every path shares, left off each option's path. */
    folder: string;
    onPick: (to: Candidate) => void;
    onClose: () => void;
}) {
    const [query, setQuery] = useState('');
    const [folderPick, setFolderPick] = useState<string[]>([]);
    const [typePick, setTypePick] = useState<GuessedKind[]>([]);
    const [limit, setLimit] = useState(FIRST_OPTIONS);
    const similar = useMemo(() => similarMaps(from, candidates, selected), [from, candidates, selected]);
    const { folders, folderOf, kinds } = useMemo(() => {
        const groups = groupByFolder(similar, folder);
        return {
            folders: groups.map((group) => group.folder),
            folderOf: new Map(groups.flatMap((group) => group.maps.map((map) => [map.path, group.folder]))),
            kinds: [...new Set(similar.map((map) => map.kind))],
        };
    }, [similar, folder]);
    const filtering = query.trim() !== '' || folderPick.length > 0 || typePick.length > 0;
    const shown = useMemo(
        () =>
            filterCandidates(similar, query).filter(
                (map) =>
                    (folderPick.length === 0 || folderPick.includes(folderOf.get(map.path) ?? '')) &&
                    (typePick.length === 0 || typePick.includes(map.kind))
            ),
        [similar, folderOf, query, folderPick, typePick]
    );
    // A new search or filter starts the list again from the top.
    const restart =
        <T,>(set: (value: T) => void) =>
        (value: T) => {
            set(value);
            setLimit(FIRST_OPTIONS);
        };
    const options = shown.slice(0, limit);
    const remaining = shown.length - options.length;
    return (
        <Popover
            open
            anchorEl={anchor}
            onClose={onClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            PaperProps={{
                role: 'dialog',
                'aria-label': SWAP_TITLE,
                sx: { width: 440, maxWidth: '95vw', maxHeight: '70vh', display: 'flex', flexDirection: 'column' },
            }}
        >
            <Box sx={{ px: 1.5, pt: 1.25, pb: 0.5, flexShrink: 0 }}>
                <Typography variant="subtitle2" component="h3" sx={{ lineHeight: 'normal' }}>
                    {SWAP_TITLE}
                </Typography>
            </Box>
            <Box sx={{ px: 1.5, pb: 1, flexShrink: 0 }}>
                <MapFilters
                    autoFocus
                    total={similar.length}
                    shown={shown.length}
                    filtering={filtering}
                    query={query}
                    onQuery={restart(setQuery)}
                    folders={folders}
                    folderPick={folderPick}
                    onFolderPick={restart(setFolderPick)}
                    kinds={kinds}
                    typePick={typePick}
                    onTypePick={restart(setTypePick)}
                />
            </Box>
            <List
                dense
                disablePadding
                sx={{ flex: 1, minHeight: 0, overflowY: 'auto', borderTop: 1, borderColor: 'divider' }}
            >
                {options.map((candidate) => (
                    <SwapOption key={candidate.path} candidate={candidate} folder={folder} onPick={onPick} />
                ))}
                {remaining > 0 && (
                    <Box sx={{ p: 1, textAlign: 'center' }}>
                        <Button size="small" onClick={() => setLimit((current) => current + MORE_OPTIONS)}>
                            Show {Math.min(MORE_OPTIONS, remaining)} more
                        </Button>
                    </Box>
                )}
                {shown.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>
                        No maps match these filters.
                    </Typography>
                )}
            </List>
        </Popover>
    );
}

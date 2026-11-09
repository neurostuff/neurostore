import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    Typography,
} from '@mui/material';
import { useCallback, useMemo, useState } from 'react';
import { FolderGroup, SelectedMapRow } from './MapRow';
import { MapFilters } from './MapFilters';
import { commonFolder } from './review';
import { SwapPicker } from './SwapPicker';
import { filterCandidates, groupByFolder, hasSimilarMap, swapMaps, type Candidate, type GuessedKind } from './tree';
import type { ShareAnalysis } from './types';

const MONO = 'Monaco, Menlo, Consolas, "Liberation Mono", monospace';

/** The maps we found in the folder the author chose. Every map sits under its folder, ticked
 * or not; the ticked ones are also gathered at the top. Nothing is sent until they confirm. */
export function TreePicker({
    candidates,
    limit,
    analyses,
    onClose,
    onUpload,
}: {
    candidates: Candidate[];
    limit: number;
    /** The paper's analyses, named so the author can tell which maps we are after. */
    analyses: ShareAnalysis[];
    onClose: () => void;
    onUpload: (chosen: Candidate[]) => void;
}) {
    const [selected, setSelected] = useState(() => new Set(candidates.filter((c) => c.selected).map((c) => c.path)));
    const [query, setQuery] = useState('');
    const [folderPick, setFolderPick] = useState<string[]>([]);
    const [typePick, setTypePick] = useState<GuessedKind[]>([]);
    const [swapping, setSwapping] = useState<{
        el: HTMLElement;
        from: Candidate;
    } | null>(null);
    // Stable, so a memoized row is not drawn again just because a sibling was ticked.
    const toggle = useCallback(
        (path: string) =>
            setSelected((current) => {
                const next = new Set(current);
                if (next.has(path)) next.delete(path);
                else next.add(path);
                return next;
            }),
        []
    );
    const startSwap = useCallback((el: HTMLElement, from: Candidate) => setSwapping({ el, from }), []);
    const chosen = candidates.filter((candidate) => selected.has(candidate.path));
    const folder = useMemo(() => commonFolder(candidates.map((candidate) => candidate.path)), [candidates]);
    const over = candidates.filter((candidate) => candidate.note === 'over the limit').length;
    const swap = (to: Candidate) => {
        if (!swapping) return;
        const { removed, added } = swapMaps(swapping.from, to, candidates, selected);
        setSelected((current) => {
            const next = new Set(current);
            for (const map of removed) next.delete(map.path);
            for (const map of added) next.add(map.path);
            return next;
        });
        setSwapping(null);
    };
    // Every folder and kind of map on offer, and which folder each map sits in. None of this
    // depends on what is ticked, so ticking a map does not rebuild the lists below.
    const { allFolders, folderOf, kinds } = useMemo(() => {
        const groups = groupByFolder(candidates, folder);
        return {
            allFolders: groups,
            folderOf: new Map(groups.flatMap((group) => group.maps.map((map) => [map.path, group.folder]))),
            kinds: [...new Set(candidates.map((candidate) => candidate.kind))],
        };
    }, [candidates, folder]);
    const filtering = query.trim() !== '' || folderPick.length > 0 || typePick.length > 0;
    const { folders, shown } = useMemo(() => {
        const visible = filterCandidates(candidates, query).filter(
            (candidate) =>
                (folderPick.length === 0 || folderPick.includes(folderOf.get(candidate.path) ?? '')) &&
                (typePick.length === 0 || typePick.includes(candidate.kind))
        );
        return { folders: groupByFolder(visible, folder), shown: visible.length };
    }, [candidates, folder, folderOf, query, folderPick, typePick]);

    const panelWidth = {
        xs: 'minmax(0, 1fr)',
        md: 'minmax(0, 1fr) minmax(0, 1fr)',
    };
    return (
        <Dialog open fullWidth maxWidth="lg" onClose={onClose} PaperProps={{ sx: { height: { md: '85vh' } } }}>
            <DialogTitle sx={{ overflowWrap: 'anywhere' }}>
                Select maps to upload
                {folder && (
                    <>
                        {' '}
                        (
                        <Box
                            component="span"
                            sx={{
                                fontFamily: MONO,
                                fontSize: '0.9em',
                                bgcolor: 'grey.200',
                                borderRadius: 0.5,
                                px: 0.75,
                                py: 0.25,
                            }}
                        >
                            {folder}
                        </Box>
                        )
                    </>
                )}
            </DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Stack spacing={1} sx={{ flexShrink: 0 }}>
                    {candidates.length === 0 && (
                        <Alert severity="info">We found no .nii or .nii.gz files in this folder.</Alert>
                    )}
                    {candidates.length > 0 && (
                        <Accordion variant="outlined" disableGutters defaultExpanded>
                            <AccordionSummary expandIcon={<span>▾</span>}>
                                <Typography variant="subtitle2" component="h3">
                                    Instructions
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Stack spacing={1}>
                                    {analyses.length > 0 && (
                                        <Box>
                                            <Typography variant="body2">
                                                We are looking for maps for the following analyses:
                                            </Typography>
                                            <Box component="ul" sx={{ m: 0, pl: 3 }}>
                                                {analyses.map((analysis) => (
                                                    <Typography component="li" variant="body2" key={analysis.key}>
                                                        {analysis.name}
                                                    </Typography>
                                                ))}
                                            </Box>
                                        </Box>
                                    )}
                                    <Typography variant="body2">
                                        We preselected some t/z, effect, and variance maps. We left out thresholded
                                        copies and other files. Modify the selection as needed.
                                    </Typography>
                                    {over > 0 && (
                                        <Alert severity="info">
                                            The upload contains more maps than the maximum number allowed ({limit}). We
                                            selected whole sets first: each t or z map with its effect map. Unselect any
                                            that are not in the paper, select relevant maps, or swap for a similar map.
                                        </Alert>
                                    )}
                                </Stack>
                            </AccordionDetails>
                        </Accordion>
                    )}
                </Stack>
                {candidates.length > 0 && (
                    <Box
                        sx={{
                            display: 'grid',
                            gap: 2,
                            gridTemplateColumns: panelWidth,
                            gridTemplateRows: { md: 'minmax(0, 1fr)' },
                            flex: { md: 1 },
                            // Never squeezed below this; the dialog scrolls instead.
                            minHeight: { md: 280 },
                        }}
                    >
                        <Stack spacing={1} sx={{ minHeight: { md: 0 } }}>
                            {candidates.length > 8 && (
                                <MapFilters
                                    total={candidates.length}
                                    shown={shown}
                                    filtering={filtering}
                                    query={query}
                                    onQuery={setQuery}
                                    folders={allFolders.map((group) => group.folder)}
                                    folderPick={folderPick}
                                    onFolderPick={setFolderPick}
                                    kinds={kinds}
                                    typePick={typePick}
                                    onTypePick={setTypePick}
                                />
                            )}
                            <Stack
                                spacing={1}
                                sx={{
                                    flex: { md: 1 },
                                    minHeight: { md: 0 },
                                    overflowY: { md: 'auto' },
                                }}
                            >
                                {folders.map((group) => (
                                    <FolderGroup
                                        key={group.folder}
                                        folder={group.folder}
                                        maps={group.maps}
                                        heading={folders.length > 1 || group.folder !== ''}
                                        selected={selected}
                                        onToggle={toggle}
                                    />
                                ))}
                                {filtering && folders.length === 0 && (
                                    <Typography variant="body2" color="text.secondary">
                                        {query.trim()
                                            ? `No maps match “${query.trim()}”.`
                                            : 'No maps match these filters.'}
                                    </Typography>
                                )}
                            </Stack>
                        </Stack>
                        <Box
                            component="section"
                            aria-label="Selected maps"
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                minHeight: { md: 0 },
                                maxHeight: { xs: '40vh', md: 'none' },
                                order: { xs: -1, md: 0 },
                                border: 1,
                                borderColor: 'divider',
                                borderRadius: 1,
                                p: 1.5,
                            }}
                        >
                            <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mb: 0.5, flexShrink: 0 }}>
                                <Typography variant="subtitle2" component="h3">
                                    Selected
                                </Typography>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color:
                                            chosen.length === 0 || chosen.length > limit
                                                ? 'error.main'
                                                : 'success.main',
                                    }}
                                >
                                    ({chosen.length} / {limit})
                                </Typography>
                            </Stack>
                            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                                {chosen.length === 0 ? (
                                    <Typography variant="body2" color="text.secondary">
                                        No maps selected yet. Select maps from the list.
                                    </Typography>
                                ) : (
                                    chosen.map((candidate) => (
                                        <SelectedMapRow
                                            key={candidate.path}
                                            candidate={candidate}
                                            folder={folder}
                                            canSwap={hasSimilarMap(candidate, candidates, selected)}
                                            onToggle={toggle}
                                            onSwap={startSwap}
                                        />
                                    ))
                                )}
                            </Box>
                            {chosen.length > limit && (
                                <Alert severity="warning" sx={{ mt: 1, flexShrink: 0 }}>
                                    This paper takes {limit} files at most; unselect some to continue.
                                </Alert>
                            )}
                        </Box>
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    variant="contained"
                    disabled={chosen.length === 0 || chosen.length > limit}
                    onClick={() => onUpload(chosen)}
                >
                    Upload {chosen.length} map{chosen.length === 1 ? '' : 's'}
                </Button>
            </DialogActions>
            {swapping && (
                <SwapPicker
                    anchor={swapping.el}
                    from={swapping.from}
                    candidates={candidates}
                    selected={selected}
                    folder={folder}
                    onPick={swap}
                    onClose={() => setSwapping(null)}
                />
            )}
        </Dialog>
    );
}

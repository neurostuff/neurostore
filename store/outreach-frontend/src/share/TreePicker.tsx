import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Stack,
    Typography,
} from '@mui/material';
import { useState } from 'react';
import { commonFolder, formatBytes, inFolder, TYPE_LABELS } from './review';
import type { Candidate } from './tree';
import type { ShareAnalysis } from './types';

/** The maps we found in the folder the author chose, the likely ones ticked and listed
 * first. Nothing is sent until they confirm. */
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
    // Grouped once when the dialog opens, so rows don't jump about while the author ticks.
    const [groups] = useState(() => ({
        ticked: candidates.filter((candidate) => candidate.selected),
        left: candidates.filter((candidate) => !candidate.selected),
    }));
    const toggle = (path: string) =>
        setSelected((current) => {
            const next = new Set(current);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
    const chosen = candidates.filter((candidate) => selected.has(candidate.path));
    const folder = commonFolder(candidates.map((candidate) => candidate.path));
    const over = candidates.filter((candidate) => candidate.note === 'over the limit').length;
    const row = (candidate: Candidate) => (
        <FormControlLabel
            key={candidate.path}
            control={
                <Checkbox size="small" checked={selected.has(candidate.path)} onChange={() => toggle(candidate.path)} />
            }
            label={
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                    {inFolder(candidate.path, folder)}{' '}
                    <Typography component="span" variant="caption" color="text.secondary">
                        {TYPE_LABELS[candidate.kind] ?? candidate.kind} · {formatBytes(candidate.file.size)}
                        {candidate.note && ` · ${candidate.note}`}
                    </Typography>
                </Typography>
            }
        />
    );
    return (
        <Dialog open fullWidth maxWidth="md" onClose={onClose}>
            <DialogTitle sx={{ overflowWrap: 'anywhere' }}>
                Maps in {folder ? `${folder}/` : 'this folder'}
            </DialogTitle>
            <DialogContent>
                <Stack spacing={1}>
                    {candidates.length === 0 && (
                        <Alert severity="info">We found no .nii or .nii.gz files in this folder.</Alert>
                    )}
                    {candidates.length > 0 && (
                        <Typography variant="body2" color="text.secondary">
                            We ticked the t/z, effect and variance maps and left out thresholded copies and other files.
                            Change the selection if needed; their folders help us tell which maps belong together.
                        </Typography>
                    )}
                    {candidates.length > 0 && analyses.length > 0 && (
                        <Box>
                            <Typography variant="body2" sx={{ mb: 0.5 }}>
                                The analyses we are looking for maps of:
                            </Typography>
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                {analyses.map((analysis) => (
                                    <Chip key={analysis.key} size="small" variant="outlined" label={analysis.name} />
                                ))}
                            </Stack>
                        </Box>
                    )}
                    {over > 0 && (
                        <Alert severity="info">
                            This folder has more maps than this paper takes ({limit}), so we ticked whole sets first: each t
                            or z map with its effect map. Untick any that are not in the paper and tick the ones that are.
                        </Alert>
                    )}
                    {candidates.length > 0 && (
                        <Typography variant="body2" color="text.secondary">
                            {chosen.length} of {candidates.length} maps ticked · this paper takes {limit} more at most
                        </Typography>
                    )}
                    {groups.ticked.map(row)}
                    {groups.ticked.length > 0 && groups.left.length > 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ pt: 0.5 }}>
                            Not ticked — each row says why. Tick any map the paper reports:
                        </Typography>
                    )}
                    {groups.left.map(row)}
                    {chosen.length > limit && (
                        <Alert severity="warning">This paper takes {limit} more files at most; untick some.</Alert>
                    )}
                </Stack>
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
        </Dialog>
    );
}

import { Alert, Box, Button, Checkbox, Paper, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { mergeAnalyses } from '../merge';
import type { DraftAnalysis } from '../types';

/** The draft's analyses, editable: rename, describe, delete, merge, add. Edits change only
 * the draft, never the paper's records. */
export function AnalysesEditor({
    analyses,
    disabled,
    saving,
    onSave,
}: {
    analyses: DraftAnalysis[];
    disabled: boolean;
    saving: boolean;
    onSave: (analyses: DraftAnalysis[]) => void;
}) {
    const [edited, setEdited] = useState(analyses);
    const [selected, setSelected] = useState<number[]>([]);
    const dirty = JSON.stringify(edited) !== JSON.stringify(analyses);
    const update = (index: number, change: Partial<DraftAnalysis>) =>
        setEdited((current) => current.map((analysis, i) => (i === index ? { ...analysis, ...change } : analysis)));
    const toggle = (index: number) =>
        setSelected((current) => (current.includes(index) ? current.filter((i) => i !== index) : [...current, index]));
    const unnamed = edited.some((analysis) => !analysis.name.trim());

    return (
        <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="h6" component="h2" sx={{ flexGrow: 1 }}>
                    Analyses ({edited.length})
                </Typography>
                <Button
                    size="small"
                    disabled={disabled || selected.length < 2}
                    onClick={() => {
                        setEdited((current) => mergeAnalyses(current, selected));
                        setSelected([]);
                    }}
                >
                    Merge selected
                </Button>
                <Button
                    size="small"
                    disabled={disabled}
                    onClick={() => setEdited((current) => [...current, { name: 'New analysis', description: null, points: [] }])}
                >
                    Add analysis
                </Button>
                <Button size="small" disabled={!dirty || saving} onClick={() => setEdited(analyses)}>
                    Undo changes
                </Button>
                <Button size="small" variant="contained" disabled={disabled || !dirty || saving || unnamed} onClick={() => onSave(edited)}>
                    Save analyses
                </Button>
            </Stack>
            {unnamed && <Alert severity="warning">Every analysis needs a name.</Alert>}
            {edited.map((analysis, index) => (
                <Paper key={analysis.key ?? `new-${index}`} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                        <Checkbox
                            checked={selected.includes(index)}
                            disabled={disabled}
                            onChange={() => toggle(index)}
                            inputProps={{ 'aria-label': `select ${analysis.name}` }}
                        />
                        <Stack spacing={1} sx={{ flexGrow: 1 }}>
                            <TextField
                                size="small"
                                label="Name"
                                value={analysis.name}
                                disabled={disabled}
                                onChange={(event) => update(index, { name: event.target.value })}
                            />
                            <TextField
                                size="small"
                                label="Description"
                                value={analysis.description ?? ''}
                                disabled={disabled}
                                multiline
                                onChange={(event) => update(index, { description: event.target.value || null })}
                            />
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    {analysis.points.length} coordinate{analysis.points.length === 1 ? '' : 's'}
                                    {analysis.points.length > 0 &&
                                        `: ${analysis.points
                                            .slice(0, 4)
                                            .map((p) => `(${p.x}, ${p.y}, ${p.z})`)
                                            .join(' ')}${analysis.points.length > 4 ? ' …' : ''}`}
                                    {analysis.points[0]?.space && ` ${analysis.points[0].space}`}
                                </Typography>
                            </Box>
                        </Stack>
                        <Button
                            color="error"
                            disabled={disabled}
                            onClick={() => {
                                setEdited((current) => current.filter((_, i) => i !== index));
                                setSelected([]);
                            }}
                        >
                            Delete
                        </Button>
                    </Stack>
                </Paper>
            ))}
        </Stack>
    );
}

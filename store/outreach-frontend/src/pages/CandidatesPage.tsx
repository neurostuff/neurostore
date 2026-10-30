import {
    Alert,
    Button,
    Checkbox,
    Link,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useApi } from '../context';

/** Papers that meet the pilot's criteria and have no draft yet. Selected ones become drafts. */
export function CandidatesPage() {
    const api = useApi();
    const queryClient = useQueryClient();
    const [year, setYear] = useState(new Date().getFullYear());
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [failures, setFailures] = useState<string[]>([]);
    const candidates = useQuery({ queryKey: ['candidates', year], queryFn: () => api.candidates(year) });

    const build = useMutation({
        mutationFn: async (ids: string[]) => {
            const failed: string[] = [];
            for (const id of ids) {
                try {
                    await api.buildDraft(id);
                } catch (error) {
                    failed.push(`${id}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
            return failed;
        },
        onSuccess: (failed) => {
            setFailures(failed);
            setSelected(new Set());
            void queryClient.invalidateQueries({ queryKey: ['candidates'] });
            void queryClient.invalidateQueries({ queryKey: ['drafts'] });
        },
    });

    const rows = candidates.data ?? [];
    const toggle = (id: string) =>
        setSelected((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    return (
        <Stack spacing={2}>
            <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="h5" component="h1" sx={{ flexGrow: 1 }}>
                    Candidates
                </Typography>
                <TextField
                    size="small"
                    type="number"
                    label="Published from"
                    value={year}
                    onChange={(event) => setYear(Number(event.target.value) || year)}
                    sx={{ width: 140 }}
                />
                <Button
                    variant="contained"
                    disabled={selected.size === 0 || build.isPending}
                    onClick={() => build.mutate([...selected])}
                >
                    Build {selected.size || ''} draft{selected.size === 1 ? '' : 's'}
                </Button>
            </Stack>
            <Typography variant="body2" color="text.secondary">
                A {year} or later paper with result coordinates, a data repository link, no NeuroVault link or
                images, and a US corresponding author with an address. Newest stored first.
            </Typography>
            {candidates.error && <Alert severity="error">{String(candidates.error)}</Alert>}
            {failures.length > 0 && (
                <Alert severity="warning" onClose={() => setFailures([])}>
                    {failures.map((failure) => (
                        <div key={failure}>{failure}</div>
                    ))}
                </Alert>
            )}
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell padding="checkbox">
                            <Checkbox
                                checked={rows.length > 0 && selected.size === rows.length}
                                indeterminate={selected.size > 0 && selected.size < rows.length}
                                onChange={(event) =>
                                    setSelected(event.target.checked ? new Set(rows.map((r) => r.base_study_id)) : new Set())
                                }
                                inputProps={{ 'aria-label': 'select all' }}
                            />
                        </TableCell>
                        <TableCell>Paper</TableCell>
                        <TableCell>Journal</TableCell>
                        <TableCell>Year</TableCell>
                        <TableCell align="right">Analyses</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={row.base_study_id} hover onClick={() => toggle(row.base_study_id)}>
                            <TableCell padding="checkbox">
                                <Checkbox checked={selected.has(row.base_study_id)} inputProps={{ 'aria-label': `select ${row.name}` }} />
                            </TableCell>
                            <TableCell>
                                {row.name}
                                {row.doi && (
                                    <Link
                                        href={`https://doi.org/${row.doi}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(event) => event.stopPropagation()}
                                        sx={{ ml: 1 }}
                                    >
                                        doi
                                    </Link>
                                )}
                            </TableCell>
                            <TableCell>{row.journal}</TableCell>
                            <TableCell>{row.year}</TableCell>
                            <TableCell align="right">{row.result_analyses}</TableCell>
                        </TableRow>
                    ))}
                    {candidates.isSuccess && rows.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5}>No candidates.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </Stack>
    );
}

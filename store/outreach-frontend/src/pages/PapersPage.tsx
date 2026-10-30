import {
    Alert,
    Button,
    Checkbox,
    Chip,
    FormControlLabel,
    MenuItem,
    Stack,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PaperLinks, PersonFlags, StatusChip } from '../components';
import { useApi } from '../context';
import {
    defaultFilters,
    matches,
    nextStep,
    paperRows,
    phaseOf,
    PHASES,
    PRESETS,
    readFilters,
    sortRows,
    writeFilters,
    type Filters,
    type Phase,
} from '../filters';
import { ago } from '../format';

const AUTHOR_CHOICES = [
    { value: 'any', label: 'Any author', filters: { emailed: null, suppressed: null } },
    { value: 'never', label: 'Never emailed', filters: { emailed: false, suppressed: null } },
    { value: 'emailed', label: 'Emailed before', filters: { emailed: true, suppressed: null } },
    { value: 'suppressed', label: 'Opted out or bounced', filters: { emailed: null, suppressed: true } },
] as const;

const authorChoice = (filters: Filters) =>
    AUTHOR_CHOICES.find((c) => c.filters.emailed === filters.emailed && c.filters.suppressed === filters.suppressed)
        ?.value ?? 'any';

/** Every paper in outreach, from candidate to published, in one list. Filters live in the URL. */
export function PapersPage() {
    const api = useApi();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [params, setParams] = useSearchParams();
    const filters = useMemo(() => readFilters(params), [params]);
    const setFilters = (change: Partial<Filters>) => setParams(writeFilters({ ...filters, ...change }), { replace: true });
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [failures, setFailures] = useState<string[]>([]);

    const candidates = useQuery({
        queryKey: ['candidates', filters.sinceYear],
        queryFn: () => api.candidates(filters.sinceYear, 1000),
    });
    const drafts = useQuery({ queryKey: ['drafts', 'all'], queryFn: () => api.drafts({ limit: 1000 }) });

    const all = useMemo(() => paperRows(candidates.data ?? [], drafts.data ?? []), [candidates.data, drafts.data]);
    const rows = useMemo(() => sortRows(all.filter((row) => matches(row, filters)), filters.sort), [all, filters]);
    const phaseCounts = useMemo(() => {
        const counts = new Map<Phase, number>();
        all.forEach((row) => counts.set(phaseOf(row.stage), (counts.get(phaseOf(row.stage)) ?? 0) + 1));
        return counts;
    }, [all]);
    const buildable = rows.filter((row) => row.stage === 'not_started');
    const chosen = buildable.filter((row) => selected.has(row.id));

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

    const toggle = (id: string) =>
        setSelected((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    const togglePhase = (phase: Phase) =>
        setFilters({
            phases: filters.phases.includes(phase)
                ? filters.phases.filter((p) => p !== phase)
                : [...filters.phases, phase],
        });
    const error = candidates.error ?? drafts.error;

    return (
        <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="h5" component="h1" sx={{ mr: 2 }}>
                    Papers
                </Typography>
                {PRESETS.map((preset) => (
                    <Button
                        key={preset.label}
                        size="small"
                        variant="outlined"
                        onClick={() => setParams(writeFilters({ ...defaultFilters(), ...preset.filters }), { replace: true })}
                    >
                        {preset.label}
                    </Button>
                ))}
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {PHASES.map((phase) => (
                    <Chip
                        key={phase.key}
                        label={`${phase.label} (${phaseCounts.get(phase.key) ?? 0})`}
                        color={filters.phases.includes(phase.key) ? 'primary' : 'default'}
                        variant={filters.phases.includes(phase.key) ? 'filled' : 'outlined'}
                        onClick={() => togglePhase(phase.key)}
                    />
                ))}
            </Stack>
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                <TextField
                    size="small"
                    label="Search title or journal"
                    value={filters.search}
                    onChange={(event) => setFilters({ search: event.target.value })}
                    sx={{ minWidth: 240 }}
                />
                <TextField
                    size="small"
                    select
                    label="Author"
                    value={authorChoice(filters)}
                    onChange={(event) =>
                        setFilters(AUTHOR_CHOICES.find((c) => c.value === event.target.value)!.filters)
                    }
                    sx={{ minWidth: 190 }}
                >
                    {AUTHOR_CHOICES.map((choice) => (
                        <MenuItem key={choice.value} value={choice.value}>
                            {choice.label}
                        </MenuItem>
                    ))}
                </TextField>
                <TextField
                    size="small"
                    type="number"
                    label="Idle at least (days)"
                    value={filters.idleDays ?? ''}
                    onChange={(event) =>
                        setFilters({ idleDays: event.target.value === '' ? null : Number(event.target.value) })
                    }
                    sx={{ width: 160 }}
                />
                <TextField
                    size="small"
                    type="number"
                    label="Candidates from"
                    value={filters.sinceYear}
                    onChange={(event) => setFilters({ sinceYear: Number(event.target.value) || filters.sinceYear })}
                    sx={{ width: 140 }}
                />
                <TextField
                    size="small"
                    select
                    label="Sort"
                    value={filters.sort}
                    onChange={(event) => setFilters({ sort: event.target.value as Filters['sort'] })}
                    sx={{ minWidth: 170 }}
                >
                    <MenuItem value="newest_paper">Newest paper</MenuItem>
                    <MenuItem value="oldest_activity">Oldest activity</MenuItem>
                </TextField>
                <FormControlLabel
                    control={<Switch checked={filters.ready} onChange={(event) => setFilters({ ready: event.target.checked })} />}
                    label="Ready to email only"
                />
            </Stack>
            <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                    Showing {rows.length} of {all.length}. A person's newest approved paper is the one ready to email;
                    their others are held so no one gets two emails.
                </Typography>
                <Button
                    variant="contained"
                    disabled={chosen.length === 0 || build.isPending}
                    onClick={() => build.mutate(chosen.map((row) => row.baseStudyId))}
                >
                    Build {chosen.length || ''} draft{chosen.length === 1 ? '' : 's'}
                </Button>
            </Stack>
            {error && <Alert severity="error">{String(error)}</Alert>}
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
                                disabled={buildable.length === 0}
                                checked={buildable.length > 0 && chosen.length === buildable.length}
                                indeterminate={chosen.length > 0 && chosen.length < buildable.length}
                                onChange={(event) =>
                                    setSelected(event.target.checked ? new Set(buildable.map((row) => row.id)) : new Set())
                                }
                                inputProps={{ 'aria-label': 'select every paper to build' }}
                            />
                        </TableCell>
                        <TableCell>Paper</TableCell>
                        <TableCell>Stage</TableCell>
                        <TableCell align="right">Analyses</TableCell>
                        <TableCell>Author</TableCell>
                        <TableCell>Next</TableCell>
                        <TableCell>Last activity</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow
                            key={row.id}
                            hover
                            sx={{ cursor: 'pointer' }}
                            onClick={() => (row.draftId ? navigate(`/drafts/${row.draftId}`) : toggle(row.id))}
                        >
                            <TableCell padding="checkbox">
                                {row.stage === 'not_started' && (
                                    <Checkbox checked={selected.has(row.id)} inputProps={{ 'aria-label': `select ${row.name}` }} />
                                )}
                            </TableCell>
                            <TableCell>
                                {row.name}
                                <Typography variant="caption" color="text.secondary" display="block">
                                    {[row.journal, row.year].filter(Boolean).join(', ')}
                                </Typography>
                                <PaperLinks doi={row.doi} pmid={row.pmid} pmcid={row.pmcid} />
                            </TableCell>
                            <TableCell>
                                <StatusChip status={row.stage} />
                            </TableCell>
                            <TableCell align="right">{row.analyses}</TableCell>
                            <TableCell>
                                <PersonFlags person={row.person} drafted={row.draftId !== null} />
                            </TableCell>
                            <TableCell>
                                <Typography variant="body2" color={row.held.length > 0 ? 'text.secondary' : 'text.primary'}>
                                    {nextStep(row)}
                                </Typography>
                            </TableCell>
                            <TableCell>{row.lastActivityAt ? ago(row.lastActivityAt) : ''}</TableCell>
                        </TableRow>
                    ))}
                    {(drafts.isSuccess || candidates.isSuccess) && rows.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={7}>Nothing matches these filters.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </Stack>
    );
}

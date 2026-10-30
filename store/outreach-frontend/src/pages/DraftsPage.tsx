import {
    Alert,
    Chip,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../context';
import { ago, STATUS_LABELS } from '../format';
import { OUTCOME_STATUSES, PROGRESS_STATUSES, type DraftStatus, type DraftSummary } from '../types';

const ALL: DraftStatus[] = [...PROGRESS_STATUSES, ...OUTCOME_STATUSES];

export function PersonFlags({ draft }: { draft: DraftSummary }) {
    const person = draft.person;
    if (!person) return <Chip size="small" color="warning" label="no address" />;
    return (
        <Stack direction="row" spacing={0.5}>
            {person.suppressed && <Chip size="small" color="error" label="opted out / bounced" />}
            {person.messages > 0 && <Chip size="small" label={`emailed ${person.messages}×`} />}
        </Stack>
    );
}

export function StatusChip({ status }: { status: DraftStatus }) {
    const color = OUTCOME_STATUSES.includes(status as (typeof OUTCOME_STATUSES)[number])
        ? 'error'
        : status === 'published'
          ? 'success'
          : 'default';
    return <Chip size="small" color={color} label={STATUS_LABELS[status] ?? status} />;
}

/** Every draft, oldest activity first, filtered by status and by how long it has been idle. */
export function DraftsPage({
    initialStatus = [],
    inProgress = false,
}: {
    initialStatus?: DraftStatus[];
    inProgress?: boolean;
}) {
    const api = useApi();
    const navigate = useNavigate();
    const [statuses, setStatuses] = useState<DraftStatus[]>(initialStatus);
    const [idleDays, setIdleDays] = useState('');
    const idle = idleDays === '' ? undefined : Math.max(0, Number(idleDays));
    const drafts = useQuery({
        queryKey: ['drafts', statuses, idle],
        queryFn: () => api.drafts({ status: statuses, idleDays: idle }),
    });
    const toggle = (status: DraftStatus) =>
        setStatuses((current) => (current.includes(status) ? current.filter((s) => s !== status) : [...current, status]));

    return (
        <Stack spacing={2}>
            <Typography variant="h5" component="h1">
                {inProgress ? 'In progress' : 'Drafts'}
            </Typography>
            {inProgress && (
                <Typography variant="body2" color="text.secondary">
                    Links opened or files uploaded, but not submitted. Oldest activity first; set idle days to find the
                    stale ones, then delete their files or nudge the author by hand.
                </Typography>
            )}
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                {ALL.map((status) => (
                    <Chip
                        key={status}
                        label={STATUS_LABELS[status]}
                        color={statuses.includes(status) ? 'primary' : 'default'}
                        variant={statuses.includes(status) ? 'filled' : 'outlined'}
                        onClick={() => toggle(status)}
                    />
                ))}
                <TextField
                    size="small"
                    type="number"
                    label="Idle at least (days)"
                    value={idleDays}
                    onChange={(event) => setIdleDays(event.target.value)}
                    sx={{ width: 170 }}
                />
            </Stack>
            {drafts.error && <Alert severity="error">{String(drafts.error)}</Alert>}
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>Paper</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Analyses</TableCell>
                        <TableCell>Author</TableCell>
                        <TableCell>Last activity</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {(drafts.data ?? []).map((draft) => (
                        <TableRow key={draft.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/drafts/${draft.id}`)}>
                            <TableCell>
                                {draft.name}
                                <Typography variant="caption" color="text.secondary" display="block">
                                    {[draft.journal, draft.year].filter(Boolean).join(', ')}
                                </Typography>
                            </TableCell>
                            <TableCell>
                                <StatusChip status={draft.status} />
                            </TableCell>
                            <TableCell align="right">{draft.analyses}</TableCell>
                            <TableCell>
                                <PersonFlags draft={draft} />
                            </TableCell>
                            <TableCell>{ago(draft.last_activity_at)}</TableCell>
                        </TableRow>
                    ))}
                    {drafts.isSuccess && drafts.data.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5}>No drafts.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </Stack>
    );
}

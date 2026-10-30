import {
    Alert,
    Button,
    Chip,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { batchBlockers } from '../batch';
import { useApi } from '../context';
import type { DraftStatus, DraftSummary } from '../types';
import { PersonFlags } from './DraftsPage';

/** Drafts not emailed yet: approved ones, and ones still waiting for approval. */
const BATCH_STATUSES: DraftStatus[] = ['draft', 'checked'];

/** Newest papers first, then the order their drafts were built. */
const byPublication = (a: DraftSummary, b: DraftSummary) =>
    (b.year ?? 0) - (a.year ?? 0) || a.created_at.localeCompare(b.created_at);

/** Drafts not emailed yet: which can go out now, and why the rest are held. A person's
 * first approved paper listed goes; their others wait, so no one gets two emails. */
export function BatchPage() {
    const api = useApi();
    const drafts = useQuery({
        queryKey: ['drafts', BATCH_STATUSES, undefined],
        queryFn: () => api.drafts({ status: BATCH_STATUSES }),
    });
    const rows = useMemo(() => [...(drafts.data ?? [])].sort(byPublication), [drafts.data]);
    const blocked = useMemo(() => batchBlockers(rows), [rows]);
    const ready = rows.filter((row) => blocked.get(row.id)?.length === 0);

    return (
        <Stack spacing={2}>
            <Typography variant="h5" component="h1">
                Batch
            </Typography>
            <Typography variant="body2" color="text.secondary">
                {ready.length} ready to email, {rows.length - ready.length} held. Open a draft to make its link and email,
                send it from your own address, then mark it sent.
            </Typography>
            {drafts.error && <Alert severity="error">{String(drafts.error)}</Alert>}
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>Paper</TableCell>
                        <TableCell>Author</TableCell>
                        <TableCell>Held because</TableCell>
                        <TableCell />
                    </TableRow>
                </TableHead>
                <TableBody>
                    {rows.map((row) => {
                        const reasons = blocked.get(row.id) ?? [];
                        return (
                            <TableRow key={row.id}>
                                <TableCell>
                                    {row.name}
                                    <Typography variant="caption" color="text.secondary" display="block">
                                        {[row.journal, row.year].filter(Boolean).join(', ')}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <PersonFlags draft={row} />
                                </TableCell>
                                <TableCell>
                                    {reasons.length === 0 ? (
                                        <Chip size="small" color="success" label="ready" />
                                    ) : (
                                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                            {reasons.map((reason) => (
                                                <Chip key={reason} size="small" label={reason} />
                                            ))}
                                        </Stack>
                                    )}
                                </TableCell>
                                <TableCell align="right">
                                    <Button component={RouterLink} to={`/drafts/${row.id}`} disabled={reasons.length > 0}>
                                        Prepare email
                                    </Button>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                    {drafts.isSuccess && rows.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={4}>No drafts waiting to be emailed.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </Stack>
    );
}

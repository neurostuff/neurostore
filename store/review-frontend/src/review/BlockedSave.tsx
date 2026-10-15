import { Alert, AlertTitle, Button, List, ListItem, Stack, Typography } from '@mui/material';
import type { Op } from '../contract/generated/review-ops';
import type { RecordIndex } from '../model/record';
import { useOpClient, useReviewStore, useReviewStoreApi } from '../store/context';
import type { Blocked } from '../store/reviewStore';
import { explain } from './explainProblem';

function opLabel(op: Op, index: RecordIndex): string {
    if (!('target' in op) || !('entity' in op.target)) return op.type;
    const name = index.entity(op.target.entity)?.name ?? op.target.entity;
    return 'path' in op.target ? `${op.type}: ${name} · ${op.target.path}` : `${op.type}: ${name}`;
}

function download(ops: Op[]) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(ops, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pending-edits.json';
    link.click();
    URL.revokeObjectURL(url);
}

export function BlockedSave() {
    const blocked = useReviewStore((s) => s.blocked);
    return blocked != null ? <Banner blocked={blocked} /> : null;
}

function Banner({ blocked: { problems } }: { blocked: Blocked }) {
    const store = useReviewStoreApi();
    const client = useOpClient();
    const pending = useReviewStore((s) => s.pending);
    const index = useReviewStore((s) => s.index);
    const record = useReviewStore((s) => s.record);
    return (
        <Alert severity="error" sx={{ borderRadius: 0 }}>
            <AlertTitle>Saving has stopped: the server refused an edit and did not say which one</AlertTitle>
            <List dense disablePadding>
                {problems.map((problem, i) => {
                    const { focus, label, message } = explain(problem, index, record);
                    return (
                        <ListItem key={i} disableGutters disablePadding>
                            {label &&
                                (focus ? (
                                    <Button
                                        size="small"
                                        color="inherit"
                                        onClick={() =>
                                            focus.slot
                                                ? store.getState().focusSlot(focus.slot)
                                                : store.getState().focusEntity(focus.entity)
                                        }
                                    >
                                        {label}
                                    </Button>
                                ) : (
                                    label
                                ))}
                            {label && ': '}
                            {message}
                        </ListItem>
                    );
                })}
            </List>
            <Typography variant="body2" sx={{ mt: 1 }}>
                Pending edits ({pending.length})
            </Typography>
            <List dense disablePadding>
                {pending.map((op) => (
                    <ListItem key={op.client_op_id} disableGutters disablePadding>
                        {opLabel(op, index)}
                    </ListItem>
                ))}
            </List>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button size="small" color="inherit" onClick={() => client.discardPending()}>
                    Discard
                </Button>
                <Button size="small" color="inherit" onClick={() => download(store.getState().pending)}>
                    Download
                </Button>
                <Button size="small" variant="contained" color="error" onClick={() => void client.undoBlocked()}>
                    Undo the edits that caused it
                </Button>
            </Stack>
        </Alert>
    );
}

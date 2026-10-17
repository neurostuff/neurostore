import { Alert, List, ListItem } from '@mui/material';
import { useSession } from '../store/context';
import type { Notice } from '../store/sessionStore';

const REASONS: Record<Notice['kind'], string> = {
    conflict: 'changed elsewhere, so this edit was dropped',
    refused: 'the server refused this edit',
    dangling: 'left dangling by a delete or a merge',
    split: 'kept on the first part of a split',
    undo: 'could not be undone',
    redo: 'could not be redone',
};

export function SaveNotices() {
    const deviceNotice = useSession((s) => s.deviceNotice);
    return (
        <>
            {deviceNotice && (
                <Alert role="note" severity="info" sx={{ borderRadius: 0 }}>
                    {deviceNotice}
                </Alert>
            )}
            <DroppedOps />
        </>
    );
}

function DroppedOps() {
    const notices = useSession((s) => s.notices);
    const dismiss = useSession((s) => s.dismissNotices);
    if (notices.length === 0) return null;
    return (
        <Alert
            role="status"
            severity="warning"
            onClose={dismiss}
            slotProps={{ closeButton: { 'aria-label': 'dismiss' } }}
            sx={{ borderRadius: 0 }}
        >
            <List dense disablePadding>
                {notices.map((notice, i) => (
                    <ListItem key={i} disableGutters disablePadding>
                        <strong>{notice.slot}</strong>: {REASONS[notice.kind]} ({notice.message})
                    </ListItem>
                ))}
            </List>
        </Alert>
    );
}

import { Alert, List, ListItem } from '@mui/material';
import { useReviewStore } from '../store/context';
import type { Notice } from '../store/reviewStore';

const REASONS: Record<Notice['kind'], string> = {
    conflict: 'changed elsewhere, so this edit was dropped',
    refused: 'the server refused this edit',
    dangling: 'left dangling by a delete',
};

export function SaveNotices() {
    const notices = useReviewStore((s) => s.notices);
    const dismiss = useReviewStore((s) => s.dismissNotices);
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

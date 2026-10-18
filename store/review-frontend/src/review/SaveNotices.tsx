import { Alert, List, ListItem } from '@mui/material';
import { useMemo } from 'react';
import type { Op } from '../contract/generated/review-ops';
import { currentAnalyses } from '../model/coordinates';
import { useSession } from '../store/context';
import type { Notice } from '../store/sessionStore';
import { targetLabeller } from './summary';

const VERBS: Partial<Record<Op['type'], string>> = {
    link: 'link',
    unlink: 'unlink',
    set_value: 'set',
    set_evidence: 'change the evidence of',
    verdict: 'judge',
    note: 'note',
    delete_entity: 'delete',
    create_entity: 'create an entity in',
    coordinate: 'change',
};

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
    const index = useSession((s) => s.index);
    const bundle = useSession((s) => s.bundle);
    const label = useMemo(() => targetLabeller(index, index, currentAnalyses(bundle)), [index, bundle]);
    const named = (notice: Notice) => {
        const op = notice.op;
        if (!op || !('target' in op)) return null;
        const what = op.target.kind === 'coordinate_parse' ? 'the coordinates' : label(op.target);
        return notice.kind === 'refused' ? `Couldn’t ${VERBS[op.type] ?? op.type} ${what}` : what;
    };
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
                        <span>
                            <strong>{named(notice) ?? notice.slot}</strong>: {REASONS[notice.kind]} ({notice.message})
                        </span>
                    </ListItem>
                ))}
            </List>
        </Alert>
    );
}

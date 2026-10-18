import { Alert, List, ListItem } from '@mui/material';
import { useMemo } from 'react';
import type { Op } from '../contract/generated/review-ops';
import { currentAnalyses } from '../model/coordinates';
import { inWords, listed, singular } from '../model/labels';
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

const REQUIRED = /'([^']+)' is a required property$/;

/** The notices in order, those of one refused op together. */
function grouped(notices: Notice[]): Notice[][] {
    const groups = new Map<unknown, Notice[]>();
    for (const notice of notices) {
        const key = notice.kind === 'refused' && notice.op ? notice.op.client_op_id : notice;
        groups.set(key, [...(groups.get(key) ?? []), notice]);
    }
    return [...groups.values()];
}

/**
 * What a group of notices says after its name: the required properties the server named, then the other messages;
 * with whether the raw messages are worth showing apart, because the line rewrote them or holds several.
 */
function told(kind: Notice['kind'], messages: string[]): { line: string; raw: boolean } {
    const needs = messages.flatMap((message) => {
        const name = REQUIRED.exec(message)?.[1];
        return name ? [inWords(name)] : [];
    });
    const others = messages.filter((message) => !REQUIRED.test(message));
    const said = others.length ? `${REASONS[kind]} (${others.join('; ')})` : '';
    const raw = needs.length > 0 || messages.length > 1;
    if (!needs.length) return { line: said, raw };
    return { line: said ? `the server needs ${listed(needs)}. ${said}` : `the server needs ${listed(needs)}.`, raw };
}

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
        if (op?.type === 'create_entity' && notice.kind === 'refused')
            return `Couldn’t add the ${inWords(singular(op.list.split('.').at(-1)!))}`;
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
                {grouped(notices).map((group, i) => {
                    const messages = group.map((notice) => notice.message);
                    const { line, raw } = told(group[0].kind, messages);
                    return (
                        <ListItem key={i} disableGutters disablePadding sx={{ display: 'block' }}>
                            <span>
                                <strong>{named(group[0]) ?? group[0].slot}</strong>: {line}
                            </span>
                            {raw && (
                                <details>
                                    <summary>details</summary>
                                    {messages.map((message, j) => (
                                        <div key={j}>{message}</div>
                                    ))}
                                </details>
                            )}
                        </ListItem>
                    );
                })}
            </List>
        </Alert>
    );
}

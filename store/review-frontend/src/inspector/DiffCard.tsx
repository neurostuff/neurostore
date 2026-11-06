import { Box } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { memo, useMemo } from 'react';
import type { DiffStatus, ReviewDiff } from '../model/diff';
import type { EntityNode, RecordIndex, SlotNode } from '../model/record';
import { useSession, useView } from '../store/context';
import { selectDiff, selectOriginalIndex } from '../store/diffSelectors';
import { CardHead } from './CardHead';
import { formatValue } from '../model/valueText';
import { statusColors, statusOf } from './status';
import { StatusLabel } from './StatusLabel';
import { slotLabel } from '../model/labels';

interface DiffRow {
    key: string;
    path: string;
    label: string;
    before?: SlotNode;
    after?: SlotNode;
    status: DiffStatus;
}

function slotStatus(diff: ReviewDiff, entity: string, slot: SlotNode): DiffStatus {
    if (slot.kind === 'value') return diff.byKey.get(slot.key)?.status ?? 'same';
    const links = diff.items.filter(
        (item) => item.kind === 'relationship' && item.entity === entity && item.path === slot.path
    );
    return links.some((item) => item.status !== 'same') ? 'changed' : 'same';
}

/** The rows of the two columns: the review's slots in its order, then the ones only the original has. */
function diffRows(
    entity: EntityNode,
    original: EntityNode | undefined,
    diff: ReviewDiff,
    indexes: { review: RecordIndex; original: RecordIndex }
): DiffRow[] {
    const before = new Map((original?.slots ?? []).map((slot) => [slot.key, slot]));
    const keys = new Set(entity.slots.map((slot) => slot.key));
    return [
        ...entity.slots.map((after) => ({
            key: after.key,
            path: after.path,
            label: slotLabel(indexes.review, after),
            before: before.get(after.key),
            after,
            status: slotStatus(diff, entity.id, after),
        })),
        ...(original?.slots ?? [])
            .filter((slot) => !keys.has(slot.key))
            .map((slot) => ({
                key: slot.key,
                path: slot.path,
                label: slotLabel(indexes.original, slot),
                before: slot,
                status: 'removed' as const,
            })),
    ];
}

function SlotSide({ slot, names }: { slot?: SlotNode; names: (id: string) => string }) {
    if (!slot) return <td>—</td>;
    const value = slot.kind === 'reference' ? slot.references.map(names).join(', ') || '—' : formatValue(slot);
    return (
        <td>
            <div>{value}</div>
            <StatusLabel id={statusOf(slot)} />
        </td>
    );
}

const tableStyles = (theme: Theme) => ({
    width: '100%',
    borderCollapse: 'collapse',
    typography: 'body2',
    '& td, & th': {
        verticalAlign: 'top',
        overflowWrap: 'anywhere',
        textAlign: 'left',
        px: 1,
        py: 0.5,
        borderBottom: 1,
        borderColor: 'divider',
    },
    '& th': { typography: 'caption', color: 'text.secondary' },
    '& td.rv-diff-path': { color: 'text.secondary' },
    '& tr[data-diff]': { cursor: 'pointer' },
    '& tr[aria-current="true"]': { bgcolor: 'action.selected' },
    '& tr:not([data-diff="same"]) td:first-of-type': { borderLeft: 3, borderLeftColor: 'primary.main' },
    '& .rv-diff': { typography: 'caption', color: 'primary.main', fontWeight: 'bold' },
    ...statusColors(theme.palette),
});

const DiffRowView = memo(function DiffRowView({
    row,
    focused,
    names,
    onFocus,
}: {
    row: DiffRow;
    focused: boolean;
    names: (id: string) => string;
    onFocus: (key: string) => void;
}) {
    return (
        <tr data-diff={row.status} aria-current={focused ? 'true' : undefined} onClick={() => onFocus(row.key)}>
            <td className="rv-diff-path" title={row.path}>
                {row.label}
            </td>
            <SlotSide slot={row.before} names={names} />
            <SlotSide slot={row.after} names={names} />
            <td>{row.status !== 'same' && <span className="rv-diff">{row.status}</span>}</td>
        </tr>
    );
});

const nameIn = (review: RecordIndex, original: RecordIndex) => (id: string) =>
    review.entity(id)?.name ?? original.entity(id)?.name ?? id;

/** An entity in two columns, the original's slots against the review's, with the changed ones marked. */
export function DiffCard({ entity, focusedSlot }: { entity: EntityNode; focusedSlot?: string }) {
    const diff = useSession(selectDiff);
    const index = useSession((s) => s.index);
    const originalIndex = useSession(selectOriginalIndex);
    const focusSlot = useView((s) => s.focusSlot);
    const original = originalIndex.entity(entity.id);
    const rows = useMemo(
        () => diffRows(entity, original, diff, { review: index, original: originalIndex }),
        [entity, original, diff, index, originalIndex]
    );
    const names = useMemo(() => nameIn(index, originalIndex), [index, originalIndex]);
    return (
        <Box component="section" aria-label={entity.name}>
            <CardHead overline={`${entity.entityClass} · diff`} title={entity.name} />
            <Box component="table" aria-label={`${entity.name}: original and review`} sx={tableStyles}>
                <thead>
                    <tr>
                        <th>field</th>
                        <th>original</th>
                        <th>review</th>
                        <th>diff</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <DiffRowView
                            key={row.key}
                            row={row}
                            focused={row.key === focusedSlot}
                            names={names}
                            onFocus={focusSlot}
                        />
                    ))}
                </tbody>
            </Box>
        </Box>
    );
}

import { Box, Chip, List, Stack, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { memo, useEffect, useRef } from 'react';
import type { EntityNode, SlotNode } from '../model/record';
import { useReviewStore } from '../store/context';
import { statusColors, statusOf } from './status';
import { StatusLabel } from './StatusLabel';

function formatValue(slot: SlotNode): string {
    const value = slot.value;
    if (!value) return '';
    if (value.extraction_status === 'not_reported') {
        return value.unreported_reason ? `not reported (${value.unreported_reason})` : 'not reported';
    }
    if (value.value === null || value.value === undefined) return '—';
    return typeof value.value === 'object' ? JSON.stringify(value.value) : String(value.value);
}

function ReferenceChips({ slot }: { slot: SlotNode }) {
    const index = useReviewStore((s) => s.index);
    const focusEntity = useReviewStore((s) => s.focusEntity);
    if (slot.references.length === 0) return <Typography variant="body2">—</Typography>;
    return (
        <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
            {slot.references.map((id) => (
                <Chip
                    key={id}
                    size="small"
                    variant="outlined"
                    label={index.entity(id)?.name ?? id}
                    onClick={(event) => {
                        event.stopPropagation();
                        focusEntity(id);
                    }}
                />
            ))}
        </Stack>
    );
}

const SlotRow = memo(function SlotRow({ slot, focused }: { slot: SlotNode; focused: boolean }) {
    const focusSlot = useReviewStore((s) => s.focusSlot);
    const ref = useRef<HTMLLIElement>(null);

    useEffect(() => {
        if (focused) ref.current?.scrollIntoView?.({ block: 'nearest' });
    }, [focused]);

    return (
        <li
            ref={ref}
            className="rv-slot"
            data-slot-key={slot.key}
            aria-current={focused ? 'true' : undefined}
            onClick={() => focusSlot(slot.key)}
        >
            <div className="rv-slot-head">
                <span className="rv-slot-path">{slot.path}</span>
                <StatusLabel id={statusOf(slot)} />
            </div>
            {slot.kind === 'reference' ? (
                <ReferenceChips slot={slot} />
            ) : (
                <div className="rv-slot-value">{formatValue(slot)}</div>
            )}
        </li>
    );
});

const slotStyles = (theme: Theme) => ({
    '& .rv-slot': {
        px: 2,
        py: 0.75,
        cursor: 'pointer',
        borderLeft: 3,
        borderColor: 'transparent',
        '&:hover': { bgcolor: 'action.hover' },
    },
    '& .rv-slot[aria-current="true"]': { borderColor: 'primary.main', bgcolor: 'action.selected' },
    '& .rv-slot-head': { typography: 'caption', display: 'flex', gap: 1.5 },
    '& .rv-slot-path': { fontFamily: 'monospace', color: 'text.secondary' },
    '& .rv-status': { display: 'inline-flex', alignItems: 'center', gap: 0.5 },
    '& .rv-slot-value': { typography: 'body2', overflowWrap: 'anywhere' },
    ...statusColors(theme.palette),
});

function EntityCard({ entity, focusedKey }: { entity: EntityNode; focusedKey: string }) {
    const classLabel =
        entity.schemaClass === entity.entityClass
            ? entity.entityClass
            : `${entity.entityClass} · ${entity.schemaClass}`;
    return (
        <Box component="section" aria-label={entity.name}>
            <Box sx={{ px: 2, pt: 2, pb: 1, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="overline" color="primary" component="div">
                    {classLabel}
                </Typography>
                <Typography variant="h6" component="h2">
                    {entity.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                    {entity.localId}
                </Typography>
            </Box>
            <List dense disablePadding sx={slotStyles}>
                {entity.slots.map((slot) => (
                    <SlotRow key={slot.key} slot={slot} focused={slot.key === focusedKey} />
                ))}
            </List>
        </Box>
    );
}

export function Inspector() {
    const entity = useReviewStore((s) => s.index.entity(s.focus.entity));
    const focusedKey = useReviewStore((s) => s.focus.key);
    if (!entity) return null;
    return <EntityCard entity={entity} focusedKey={focusedKey} />;
}

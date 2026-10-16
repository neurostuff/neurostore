import { Box, Chip, List, Stack, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { memo, type ReactNode, useEffect, useMemo, useRef } from 'react';
import type { EntityNode, SlotNode } from '../model/record';
import { entityKey } from '../model/targetKey';
import { ActionToolbar } from '../review/ActionToolbar';
import { useReviewStore, useReviewStoreApi } from '../store/context';
import type { Panel } from '../store/reviewStore';
import { pendingStructure, setValue, slotSchema, unlink } from './actions';
import { CreateDialog, DeleteDialog, LinkPanel, NotePanel, RejectPanel } from './panels';
import { RemoveIcon } from './RemoveIcon';
import { extractionSchema } from './schema';
import { SlotEditor } from './SlotEditor';
import { reviewStatus, statusColors, statusOf } from './status';
import { StatusLabel } from './StatusLabel';

function formatValue(slot: SlotNode): string {
    const value = slot.value;
    if (!value) return 'not in the record';
    if (value.extraction_status === 'not_reported') {
        return value.unreported_reason ? `not reported (${value.unreported_reason})` : 'not reported';
    }
    if (value.value === null || value.value === undefined) return '—';
    return typeof value.value === 'object' ? JSON.stringify(value.value) : String(value.value);
}

function ReferenceChips({ slot }: { slot: SlotNode }) {
    const store = useReviewStoreApi();
    const index = useReviewStore((s) => s.index);
    const pending = useReviewStore((s) => s.pending);
    const focusEntity = useReviewStore((s) => s.focusEntity);
    const focusLink = useReviewStore((s) => s.focusLink);
    const { linksBySlot } = useMemo(() => pendingStructure({ pending }), [pending]);
    const pendingLinks = linksBySlot.get(slot.key);
    const linking = [...(pendingLinks ?? [])].flatMap(([id, type]) => (type === 'link' ? [id] : []));
    const nameOf = (id: string) => index.entity(id)?.name ?? id;
    if (slot.references.length === 0 && linking.length === 0) return <Typography variant="body2">—</Typography>;
    return (
        <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
            {slot.references.map((id) => {
                const unlinking = pendingLinks?.get(id) === 'unlink';
                const label = unlinking ? `${nameOf(id)} · unlinking` : nameOf(id);
                return (
                    <Chip
                        key={id}
                        size="small"
                        variant="outlined"
                        label={label}
                        aria-label={label}
                        aria-busy={unlinking || undefined}
                        onFocus={() => focusLink(slot.key, id)}
                        onClick={(event) => {
                            event.stopPropagation();
                            focusEntity(id);
                        }}
                        onDelete={unlinking ? undefined : () => void unlink(store.getState(), slot, id)}
                        deleteIcon={<RemoveIcon label={`unlink ${nameOf(id)}`} />}
                    />
                );
            })}
            {linking
                .filter((id) => !slot.references.includes(id))
                .map((id) => (
                    <Chip key={`linking:${id}`} size="small" label={`${nameOf(id)} · linking`} aria-busy disabled />
                ))}
        </Stack>
    );
}

function SlotPanel({ panel, slot, label }: { panel: Panel; slot: SlotNode; label: string }) {
    const store = useReviewStoreApi();
    const closePanel = useReviewStore((s) => s.closePanel);
    const schema = useMemo(() => slotSchema(store.getState(), slot), [store, slot]);
    switch (panel.kind) {
        case 'edit':
        case 'not_reported':
            if (!schema)
                return (
                    <Typography variant="body2" color="error">
                        no schema for this slot
                    </Typography>
                );
            return (
                <SlotEditor
                    label={slot.path}
                    schema={schema}
                    root={extractionSchema()}
                    value={slot.value}
                    mode={panel.kind}
                    onSave={(value) => {
                        if (setValue(store.getState(), slot, value)) closePanel();
                    }}
                    onCancel={closePanel}
                />
            );
        case 'reject':
            return <RejectPanel target={panel.target} label={label} />;
        case 'note':
            return <NotePanel target={panel.target} label={label} />;
        case 'link':
            return <LinkPanel slot={slot} />;
        default:
            return null;
    }
}

const SlotRow = memo(function SlotRow({
    slot,
    focused,
    panel,
}: {
    slot: SlotNode;
    focused: boolean;
    panel: Panel | null;
}) {
    const focusSlot = useReviewStore((s) => s.focusSlot);
    const reviewed = useReviewStore((s) => s.provenance[slot.key]?.state);
    const panelLabel = useReviewStore((s) => {
        const target = panel?.target;
        if (target?.kind !== 'relationship') return slot.path;
        return `${slot.path} → ${s.index.entity(target.target_entity)?.name ?? target.target_entity}`;
    });
    const ref = useRef<HTMLLIElement>(null);
    const editing = panel?.kind === 'edit' || panel?.kind === 'not_reported';

    useEffect(() => {
        if (focused) ref.current?.scrollIntoView?.({ block: 'nearest' });
    }, [focused]);

    return (
        <li
            ref={ref}
            className="rv-slot"
            data-slot-key={slot.key}
            aria-current={focused ? 'true' : undefined}
            onClick={() => {
                if (!panel) focusSlot(slot.key);
            }}
        >
            <div className="rv-slot-head">
                <span className="rv-slot-path">{slot.path}</span>
                <StatusLabel id={statusOf(slot)} />
                {reviewed && <StatusLabel id={reviewStatus(reviewed)} />}
            </div>
            {!editing &&
                (slot.kind === 'reference' ? (
                    <ReferenceChips slot={slot} />
                ) : (
                    <div className="rv-slot-value">{formatValue(slot)}</div>
                ))}
            {panel && <SlotPanel panel={panel} slot={slot} label={panelLabel} />}
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
    '& .rv-slot-value': { typography: 'body2', overflowWrap: 'anywhere' },
    ...statusColors(theme.palette),
});

const headStyles = (theme: Theme) => ({
    px: 2,
    pt: 2,
    pb: 1,
    borderBottom: 1,
    borderColor: 'divider',
    ...statusColors(theme.palette),
});

/** The head of a card: its overline and title, then whatever else the head holds. */
export function CardHead({ overline, title, children }: { overline: string; title: string; children?: ReactNode }) {
    return (
        <Box sx={headStyles}>
            <Typography variant="overline" color="primary" component="div">
                {overline}
            </Typography>
            <Typography variant="h6" component="h2">
                {title}
            </Typography>
            {children}
        </Box>
    );
}

function EntityCard({ entity, focusedSlot }: { entity: EntityNode; focusedSlot?: string }) {
    const panel = useReviewStore((s) => s.panel);
    const reviewed = useReviewStore((s) => s.provenance[entityKey(entity.id)]?.state);
    const deleting = useReviewStore((s) => pendingStructure(s).deleting.has(entity.id));
    const panelSlot = useReviewStore((s) => s.panel?.slot);
    const classLabel =
        entity.schemaClass === entity.entityClass
            ? entity.entityClass
            : `${entity.entityClass} · ${entity.schemaClass}`;
    const entityPanel =
        panel && !panel.slot && panel.target.kind === 'entity' && panel.target.entity === entity.id ? panel : null;
    return (
        <Box component="section" aria-label={entity.name}>
            <CardHead overline={classLabel} title={entity.name}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                        {entity.localId}
                    </Typography>
                    {reviewed && <StatusLabel id={reviewStatus(reviewed)} />}
                    {deleting && (
                        <Typography variant="caption" color="error">
                            deleting…
                        </Typography>
                    )}
                </Stack>
                {entityPanel?.kind === 'reject' && <RejectPanel target={entityPanel.target} label={entity.name} />}
                {entityPanel?.kind === 'note' && <NotePanel target={entityPanel.target} label={entity.name} />}
            </CardHead>
            <List dense disablePadding sx={slotStyles}>
                {entity.slots.map((slot) => (
                    <SlotRow
                        key={slot.key}
                        slot={slot}
                        focused={slot.key === focusedSlot}
                        panel={panelSlot === slot.key ? panel : null}
                    />
                ))}
            </List>
        </Box>
    );
}

function PendingChanges() {
    const pending = useReviewStore((s) => s.pending);
    const { creating } = useMemo(() => pendingStructure({ pending }), [pending]);
    return (
        <Box role="status" aria-label="pending changes" sx={{ px: 2, typography: 'caption', color: 'text.secondary' }}>
            {creating.map(({ list }, i) => (
                <div key={i}>{`creating an entity in ${list}…`}</div>
            ))}
        </Box>
    );
}

export function Inspector() {
    const entity = useReviewStore((s) => s.index.entity(s.focus.entity));
    const focusedSlot = useReviewStore((s) => s.focus.slot);
    const deleting = useReviewStore((s) =>
        s.panel?.kind === 'delete' && s.panel.target.kind === 'entity' ? s.panel.target.entity : null
    );
    const creating = useReviewStore((s) => s.panel?.kind === 'create');
    return (
        <>
            <ActionToolbar scope="record" label="review actions" />
            <PendingChanges />
            {entity && <EntityCard entity={entity} focusedSlot={focusedSlot} />}
            {deleting && <DeleteDialog entity={deleting} />}
            {creating && <CreateDialog />}
        </>
    );
}

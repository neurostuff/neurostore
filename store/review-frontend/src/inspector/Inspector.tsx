import { Box, Chip, List, Stack, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { memo, type ReactNode, useEffect, useMemo, useRef } from 'react';
import type { EntityNode, SlotNode } from '../model/record';
import { entityKey } from '../model/targetKey';
import { ActionToolbar, CardAction, FieldActions } from '../review/ActionToolbar';
import { openPanelOn } from './openPanel';
import { useEditorName } from '../review/editor';
import { useIsEditable, useReviewStores, useSession, useView } from '../store/context';
import type { Panel } from '../store/viewStore';
import { saveSlotValue } from '../coordinates/actions';
import { CoordinatesOf } from '../coordinates/RecordLinks';
import { pendingStructure, slotSchema, unlink } from './actions';
import { CreateDialog, DeleteDialog, LinkPanel, MoveEvidencePanel, NotePanel, RejectPanel } from './panels';
import { RemoveIcon } from './RemoveIcon';
import { extractionSchema } from '../model/schema';
import { SlotEditor } from './SlotEditor';
import { CardHead } from './CardHead';
import { ValueView } from './ValueView';
import { AnalysedN } from './AnalysedN';
import { selectNotes } from '../review/outline';
import { NoteMark } from './NoteMark';
import { reviewStatus, statusColors, statusOf } from './status';
import { labelOf } from '../model/labels';
import { StatusLabel, StatusLegend } from './StatusLabel';

function ReferenceChips({ slot }: { slot: SlotNode }) {
    const stores = useReviewStores();
    const editable = useIsEditable();
    const index = useSession((s) => s.index);
    const pending = useSession((s) => s.pending);
    const focusEntity = useView((s) => s.focusEntity);
    const focusLink = useView((s) => s.focusLink);
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
                        title={id}
                        aria-busy={unlinking || undefined}
                        onFocus={() => focusLink(slot.key, id)}
                        onClick={(event) => {
                            event.stopPropagation();
                            focusEntity(id);
                        }}
                        onDelete={unlinking || !editable ? undefined : () => void unlink(stores, slot, id)}
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

function SlotPanel({
    panel,
    slot,
    label,
    panelLabel,
}: {
    panel: Panel;
    slot: SlotNode;
    label: string;
    panelLabel: string;
}) {
    const stores = useReviewStores();
    const closePanel = useView((s) => s.closePanel);
    const bundle = useSession((s) => s.bundle);
    const record = useSession((s) => s.record);
    const schema = useMemo(() => slotSchema({ bundle, record }, slot), [bundle, record, slot]);
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
                    label={label}
                    schema={schema}
                    root={extractionSchema()}
                    value={slot.value}
                    mode={panel.kind}
                    onSave={(value) => {
                        if (saveSlotValue(stores, slot, value)) closePanel();
                    }}
                    onCancel={closePanel}
                />
            );
        case 'reject':
            return <RejectPanel target={panel.target} label={panelLabel} />;
        case 'note':
            return <NotePanel target={panel.target} label={panelLabel} />;
        case 'link':
            return <LinkPanel slot={slot} label={label} />;
        case 'move_evidence':
            return panel.span ? <MoveEvidencePanel slot={slot} span={panel.span} /> : null;
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
    const stores = useReviewStores();
    const focusSlot = useView((s) => s.focusSlot);
    const reviewed = useSession((s) => s.provenance[slot.key]?.state);
    const slotEditor = useEditorName(slot.key);
    const label = useSession((s) => labelOf(s.index, slot));
    const panelLabel = useSession((s) => {
        const target = panel?.target;
        if (target?.kind !== 'relationship') return label;
        return `${label} → ${s.index.entity(target.target_entity)?.name ?? target.target_entity}`;
    });
    const notes = useSession((s) => selectNotes(s).get(slot.key)?.join('\n'));
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
            onDoubleClick={() => {
                if (panel) return;
                focusSlot(slot.key);
                openPanelOn(stores, slot.kind === 'reference' ? 'link' : 'edit');
            }}
        >
            <div className="rv-slot-head">
                <span className="rv-slot-label" title={slot.path}>
                    {label}
                </span>
                <StatusLabel id={statusOf(slot)} />
                {reviewed && <StatusLabel id={reviewStatus(reviewed)} by={slotEditor} />}
                {notes && <NoteMark notes={notes} />}
            </div>
            {!editing &&
                (slot.kind === 'reference' ? (
                    <ReferenceChips slot={slot} />
                ) : (
                    <div className="rv-slot-value">
                        <ValueView slot={slot} />
                    </div>
                ))}
            {focused && !panel && <FieldActions label={label} />}
            {panel && <SlotPanel panel={panel} slot={slot} label={label} panelLabel={panelLabel} />}
        </li>
    );
});

const legendStyles = (theme: Theme) => ({
    px: 2,
    '& .rv-legend': {
        display: 'flex',
        flexWrap: 'wrap',
        columnGap: 1.5,
        listStyle: 'none',
        p: 0,
        my: 0.5,
        opacity: 0.85,
    },
    ...statusColors(theme.palette),
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
    '& .rv-slot-label': { color: 'text.secondary', fontWeight: 500 },
    '& .rv-slot-value': { typography: 'body2', overflowWrap: 'anywhere' },
    '& .rv-values': { m: 0, pl: 2.5 },
    ...statusColors(theme.palette),
});

export function EntityCard({ entity, focusedSlot }: { entity: EntityNode; focusedSlot?: string }) {
    const panel = useView((s) => s.panel);
    const reviewed = useSession((s) => s.provenance[entityKey(entity.id)]?.state);
    const entityEditor = useEditorName(entityKey(entity.id));
    const deleting = useSession((s) => pendingStructure(s).deleting.has(entity.id));
    const notes = useSession((s) => selectNotes(s).get(entityKey(entity.id))?.join('\n'));
    const panelSlot = useView((s) => s.panel?.slot);
    const classLabel =
        entity.schemaClass === entity.entityClass
            ? entity.entityClass
            : `${entity.entityClass} · ${entity.schemaClass}`;
    const entityPanel =
        panel && !panel.slot && panel.target.kind === 'entity' && panel.target.entity === entity.id ? panel : null;
    return (
        <Box component="section" aria-label={entity.name}>
            <CardHead overline={classLabel} title={entity.name} titleTooltip={entity.localId}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                    {reviewed && <StatusLabel id={reviewStatus(reviewed)} by={entityEditor} />}
                    {notes && <NoteMark notes={notes} />}
                    <CardAction shortcut="Shift+A" />
                    {deleting && (
                        <Typography variant="caption" color="error">
                            deleting…
                        </Typography>
                    )}
                </Stack>
                <AnalysedN entity={entity} />
                <CoordinatesOf entity={entity} />
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
    const pending = useSession((s) => s.pending);
    const { creating } = useMemo(() => pendingStructure({ pending }), [pending]);
    return (
        <Box role="status" aria-label="pending changes" sx={{ px: 2, typography: 'caption', color: 'text.secondary' }}>
            {creating.map(({ list }, i) => (
                <div key={i}>{`creating an entity in ${list}…`}</div>
            ))}
        </Box>
    );
}

/** The inspector's toolbar, pending changes and dialogs around `children`. */
export function InspectorFrame({ children }: { children?: ReactNode }) {
    const deleting = useView((s) =>
        s.panel?.kind === 'delete' && s.panel.target.kind === 'entity' ? s.panel.target.entity : null
    );
    const creating = useView((s) => s.panel?.kind === 'create');
    return (
        <>
            <ActionToolbar scope="record" label="review actions" />
            <Box sx={legendStyles}>
                <StatusLegend />
            </Box>
            <PendingChanges />
            {children}
            {deleting && <DeleteDialog entity={deleting} />}
            {creating && <CreateDialog />}
        </>
    );
}

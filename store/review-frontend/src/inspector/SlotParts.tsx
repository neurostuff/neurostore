import { FieldActions } from '../review/actionButtons';
import { useEditorName } from '../review/editor';
import { selectNotes } from '../review/outline';
import type { SlotNode } from '../model/record';
import { useSession } from '../store/context';
import type { Panel } from '../store/viewStore';
import { NoteMark } from './NoteMark';
import { SlotPanel } from './SlotPanel';
import { reviewStatus, statusOf } from './status';
import { StatusLabel } from './StatusLabel';

/** A field's head: its label, its status, who reviewed it, and its notes. */
export function SlotHead({ slot, label }: { slot: SlotNode; label: string }) {
    const reviewed = useSession((s) => s.provenance[slot.key]?.state);
    const slotEditor = useEditorName(slot.key);
    const notes = useSession((s) => selectNotes(s).get(slot.key)?.join('\n'));
    return (
        <div className="rv-slot-head">
            <span className="rv-slot-label" title={slot.path}>
                {label}
            </span>
            <StatusLabel id={statusOf(slot)} />
            {reviewed && <StatusLabel id={reviewStatus(reviewed)} by={slotEditor} />}
            {notes && <NoteMark notes={notes} />}
        </div>
    );
}

/** What sits under a focused field: the panel open on it, else its field actions. */
export function SlotBody({
    slot,
    label,
    panel,
    valueLabels,
}: {
    slot: SlotNode;
    label: string;
    panel: Panel | null;
    valueLabels?: Record<string, string>;
}) {
    const panelLabel = useSession((s) => {
        const target = panel?.target;
        if (target?.kind !== 'relationship') return label;
        return `${label} → ${s.index.entity(target.target_entity)?.name ?? target.target_entity}`;
    });
    return panel ? (
        <SlotPanel panel={panel} slot={slot} label={label} panelLabel={panelLabel} valueLabels={valueLabels} />
    ) : (
        <FieldActions label={label} />
    );
}

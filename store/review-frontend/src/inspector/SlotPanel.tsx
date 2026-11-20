import { Typography } from '@mui/material';
import { useMemo } from 'react';
import { saveSlotValue } from '../coordinates/actions';
import type { SlotNode } from '../model/record';
import { extractionSchema } from '../model/schema';
import { useReviewStores, useSession, useView } from '../store/context';
import type { Panel } from '../store/viewStore';
import { slotSchema } from './actions';
import { LinkPanel, MoveEvidencePanel, NotePanel, RejectPanel } from './panels';
import { SlotEditor } from './SlotEditor';

/** The panel open on the slot `slot`: its editor, or the reject, note, link or move-evidence panel. */
export function SlotPanel({
    panel,
    slot,
    label,
    panelLabel,
    valueLabels,
}: {
    panel: Panel;
    slot: SlotNode;
    label: string;
    panelLabel: string;
    /** The words for the values of a closed choice, passed to its editor. */
    valueLabels?: Record<string, string>;
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
                    valueLabels={valueLabels}
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
            return <LinkPanel slot={slot} label={`link ${label} to`} />;
        case 'move_evidence':
            return panel.span ? <MoveEvidencePanel slot={slot} span={panel.span} /> : null;
        default:
            return null;
    }
}

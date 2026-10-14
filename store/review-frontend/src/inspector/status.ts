import { darken, type Palette } from '@mui/material/styles';
import type { SlotNode } from '../model/record';

export type Shape = 'ring' | 'triangle' | 'diamond' | 'bar' | 'circle' | 'square';

export interface SlotStatus {
    label: string;
    shape: Shape;
    color: (palette: Palette) => string;
}

export const STATUSES = {
    not_found: { label: 'evidence not found', shape: 'ring', color: (p) => darken(p.error.main, 0.3) },
    generated: { label: 'value generated', shape: 'triangle', color: (p) => darken(p.warning.main, 0.3) },
    ambiguous: { label: 'not reported (ambiguous)', shape: 'diamond', color: (p) => darken(p.warning.main, 0.3) },
    not_reported: { label: 'not reported', shape: 'bar', color: (p) => darken(p.muted.main, 0.4) },
    present: { label: 'evidence present', shape: 'circle', color: (p) => darken(p.success.main, 0.3) },
    reference: { label: 'reference', shape: 'square', color: (p) => p.primary.main },
} satisfies Record<string, SlotStatus>;

export type StatusId = keyof typeof STATUSES;

export function statusOf(slot: SlotNode): StatusId {
    if (slot.kind === 'reference') return 'reference';
    if (slot.doubt !== 'other') return slot.doubt;
    if (slot.value?.extraction_status === 'not_reported') return 'not_reported';
    return slot.value?.evidence?.status === 'present' ? 'present' : 'not_found';
}

export const statusColors = (palette: Palette) =>
    Object.fromEntries(
        Object.entries(STATUSES).map(([id, status]) => [`& [data-status="${id}"]`, { color: status.color(palette) }])
    );

import { darken, type Palette } from '@mui/material/styles';
import type { Provenance } from '../contract/generated/review-bundle';
import type { SlotNode } from '../model/record';

export type Shape =
    'ring' | 'dashed' | 'triangle' | 'diamond' | 'bar' | 'circle' | 'square' | 'check' | 'pencil' | 'cross' | 'plus';

export interface SlotStatus {
    label: string;
    shape: Shape;
    color: (palette: Palette) => string;
}

export const STATUSES = {
    absent: { label: 'not in the record', shape: 'dashed', color: (p) => darken(p.muted.main, 0.4) },
    not_found: { label: 'evidence not found', shape: 'ring', color: (p) => darken(p.error.main, 0.3) },
    generated: { label: 'value generated', shape: 'triangle', color: (p) => darken(p.warning.main, 0.3) },
    ambiguous: { label: 'not reported (ambiguous)', shape: 'diamond', color: (p) => darken(p.warning.main, 0.3) },
    not_reported: { label: 'not reported', shape: 'bar', color: (p) => darken(p.muted.main, 0.4) },
    present: { label: 'evidence present', shape: 'circle', color: (p) => darken(p.success.main, 0.3) },
    reference: { label: 'reference', shape: 'square', color: (p) => p.primary.main },
    verified: { label: 'verified', shape: 'check', color: (p) => darken(p.success.main, 0.3) },
    edited: { label: 'edited', shape: 'pencil', color: (p) => p.primary.main },
    rejected: { label: 'rejected', shape: 'cross', color: (p) => darken(p.error.main, 0.3) },
    added: { label: 'added', shape: 'plus', color: (p) => p.primary.main },
} satisfies Record<string, SlotStatus>;

export type StatusId = keyof typeof STATUSES;

const REVIEWED: Record<Provenance['state'], StatusId> = {
    verified: 'verified',
    edited: 'edited',
    removed: 'rejected',
    added: 'added',
};

/** The status a reviewer's decision gives, from the provenance state of its target. */
export const reviewedStatus = (state: Provenance['state']): StatusId => REVIEWED[state];

export function statusOf(slot: SlotNode): StatusId {
    if (slot.kind === 'reference') return 'reference';
    if (!slot.value) return 'absent';
    if (slot.doubt !== 'other') return slot.doubt;
    if (slot.value?.extraction_status === 'not_reported') return 'not_reported';
    return slot.value?.evidence?.status === 'present' ? 'present' : 'not_found';
}

export const statusColors = (palette: Palette) => ({
    '& .rv-status': { typography: 'caption', display: 'inline-flex', alignItems: 'center', gap: 0.5 },
    ...Object.fromEntries(
        Object.entries(STATUSES).map(([id, status]) => [`& [data-status="${id}"]`, { color: status.color(palette) }])
    ),
});

import { darken, lighten, type Palette } from '@mui/material/styles';
import type { Provenance } from '../contract/generated/review-bundle';
import { isDoubtful, type SlotNode } from '../model/record';

export type Shape =
    | 'ring'
    | 'dashed'
    | 'triangle'
    | 'diamond'
    | 'bar'
    | 'circle'
    | 'square'
    | 'check'
    | 'pencil'
    | 'cross'
    | 'plus'
    | 'dot';

export interface SlotStatus {
    label: string;
    /** What the status tells the reviewer, and what to do about it. */
    means: string;
    shape: Shape;
    color: (palette: Palette) => string;
}

/** `colour` moved `amount` away from the background: darker in light mode, lighter in dark. */
const deepened = (p: Palette, colour: string, amount: number) =>
    p.mode === 'dark' ? lighten(colour, amount) : darken(colour, amount);

export const STATUSES = {
    absent: {
        label: 'not in the record',
        means: 'the record has no value here; set one if the paper reports it',
        shape: 'dashed',
        color: (p) => deepened(p, p.muted.main, 0.4),
    },
    not_found: {
        label: 'evidence not found',
        means: 'the model gave a value but found no text for it; add the evidence, or check the value',
        shape: 'ring',
        color: (p) => deepened(p, p.error.main, 0.3),
    },
    generated: {
        label: 'value generated',
        means: 'the model worked the value out; check it against the text',
        shape: 'triangle',
        color: (p) => deepened(p, p.warning.main, 0.3),
    },
    ambiguous: {
        label: 'not reported (ambiguous)',
        means: 'the model found the paper unclear on this',
        shape: 'diamond',
        color: (p) => deepened(p, p.warning.main, 0.3),
    },
    not_reported: {
        label: 'not reported',
        means: 'the paper does not report this',
        shape: 'bar',
        color: (p) => deepened(p, p.muted.main, 0.4),
    },
    present: {
        label: 'evidence present',
        means: 'the value has supporting text, highlighted in the paper',
        shape: 'circle',
        color: (p) => deepened(p, p.success.main, 0.3),
    },
    reference: {
        label: 'reference',
        means: 'a link to other entities of the record',
        shape: 'square',
        color: (p) => p.primary.main,
    },
    verified: {
        label: 'verified',
        means: 'a reviewer accepted it',
        shape: 'check',
        color: (p) => deepened(p, p.success.main, 0.3),
    },
    edited: { label: 'edited', means: 'a reviewer changed it', shape: 'pencil', color: (p) => p.primary.main },
    rejected: {
        label: 'rejected',
        means: 'a reviewer rejected it',
        shape: 'cross',
        color: (p) => deepened(p, p.error.main, 0.3),
    },
    added: { label: 'added', means: 'a reviewer added it', shape: 'plus', color: (p) => p.primary.main },
    unchecked: {
        label: 'unchecked',
        means: 'no reviewer has judged it yet',
        shape: 'dot',
        color: (p) => deepened(p, p.muted.main, 0.4),
    },
} satisfies Record<string, SlotStatus>;

export type StatusId = keyof typeof STATUSES;

const REVIEWED: Record<Provenance['state'], StatusId> = {
    verified: 'verified',
    edited: 'edited',
    removed: 'rejected',
    added: 'added',
};

/** A target's review status, from the provenance state of its target; unchecked until a person has looked at it. */
export const reviewStatus = (state: Provenance['state'] | undefined): StatusId =>
    state ? REVIEWED[state] : 'unchecked';

export function statusOf(slot: SlotNode): StatusId {
    if (slot.kind === 'reference') return 'reference';
    if (!slot.value) return 'absent';
    if (isDoubtful(slot)) return slot.doubt;
    if (slot.value?.extraction_status === 'not_reported') return 'not_reported';
    return slot.value?.evidence?.status === 'present' ? 'present' : 'not_found';
}

export const statusColors = (palette: Palette) => ({
    '& .rv-status': { typography: 'caption', display: 'inline-flex', alignItems: 'center', gap: 0.5 },
    ...Object.fromEntries(
        Object.entries(STATUSES).map(([id, status]) => [`& [data-status="${id}"]`, { color: status.color(palette) }])
    ),
});

/** The underline of a value still to check, and of one a reviewer has judged. */
export const underlines = (palette: Palette) => ({ unchecked: palette.primary.main, judged: palette.text.secondary });

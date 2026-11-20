import type { RecordIndex, SpanPair } from '../model/record';
import type { ViewState } from '../store/viewStore';

export const PALETTE_KINDS = {
    entity: 'entities',
    slot: 'slots',
    value: 'values',
    text: 'paper text',
} as const;

export type PaletteKind = keyof typeof PALETTE_KINDS;

const KINDS = Object.keys(PALETTE_KINDS) as PaletteKind[];

export interface PaletteEntry {
    /** Unique across the index, so it keys a result the same way whatever the query. */
    id: string;
    kind: PaletteKind;
    label: string;
    detail: string;
    /** The lower-cased words a query is matched against. */
    haystack: string;
    run(state: ViewState): void;
}

export interface PaletteIndex {
    entries: PaletteEntry[];
}

export interface PaletteGroup {
    kind: PaletteKind;
    entries: PaletteEntry[];
}

const RESULTS_PER_KIND = 20;
const PASSAGE_LABEL = 120;

function valueText(value: unknown): string {
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function passages(text: string): PaletteEntry[] {
    const entries: PaletteEntry[] = [];
    let lineStart = 0;
    for (const line of text.split('\n')) {
        const body = line.trim();
        if (body) {
            const start = lineStart + line.indexOf(body);
            const span: SpanPair = [start, start + body.length];
            entries.push({
                id: `text:${start}`,
                kind: 'text',
                label: body.slice(0, PASSAGE_LABEL),
                detail: PALETTE_KINDS.text,
                haystack: body.toLowerCase(),
                run: (s) => s.revealSpan(span),
            });
        }
        lineStart += line.length + 1;
    }
    return entries;
}

export function buildPaletteIndex(index: RecordIndex, text: string): PaletteIndex {
    const entries: PaletteEntry[] = [];
    for (const entity of index.visible) {
        entries.push({
            id: `entity:${entity.id}`,
            kind: 'entity',
            label: entity.name,
            detail: entity.entityClass,
            haystack: `${entity.name} ${entity.entityClass}`.toLowerCase(),
            run: (s) => s.focusEntity(entity.id),
        });
        for (const slot of entity.slots) {
            entries.push({
                id: `slot:${slot.key}`,
                kind: 'slot',
                label: slot.path,
                detail: entity.name,
                haystack: slot.path.toLowerCase(),
                run: (s) => s.focusSlot(slot.key),
            });
            const value = slot.value;
            if (value?.extraction_status === 'extracted' && value.value != null) {
                const label = valueText(value.value);
                entries.push({
                    id: `value:${slot.key}`,
                    kind: 'value',
                    label,
                    detail: `${entity.name} · ${slot.path}`,
                    haystack: label.toLowerCase(),
                    run: (s) => s.focusSlot(slot.key),
                });
            }
        }
    }
    return { entries: [...entries, ...passages(text)] };
}

export function searchPalette(palette: PaletteIndex, query: string): PaletteGroup[] {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    const found = new Map<PaletteKind, PaletteEntry[]>(KINDS.map((kind) => [kind, []]));
    for (const entry of palette.entries) {
        const bucket = found.get(entry.kind)!;
        if (bucket.length < RESULTS_PER_KIND && entry.haystack.includes(needle)) bucket.push(entry);
    }
    return KINDS.flatMap((kind) => {
        const entries = found.get(kind)!;
        return entries.length > 0 ? [{ kind, entries }] : [];
    });
}

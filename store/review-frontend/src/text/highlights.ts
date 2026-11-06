import type { SpanPair } from '../model/record';
import type { TextIndex } from './TextIndex';

export interface HighlightNames {
    focus: string;
    evidence: string;
    /** The original's spans of the focused item, while the diff is shown. */
    original: string;
    /** The span a jump just scrolled to, for a moment. */
    pulse: string;
    /** The span being moved by its handles, where it would go. */
    moving: string;
}

export const REVIEW_HIGHLIGHTS: HighlightNames = {
    focus: 'rv-focus',
    evidence: 'rv-evidence',
    original: 'rv-original',
    pulse: 'rv-pulse',
    moving: 'rv-moving',
};

const spanKey = ([start, end]: SpanPair) => `${start}:${end}`;

const FOCUS_PRIORITY = 1;
const PULSE_PRIORITY = 2;
const MOVING_PRIORITY = 3;

export function highlightsSupported() {
    return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight === 'function';
}

export class HighlightLayer {
    private readonly ranges = new Map<string, Range>();

    constructor(
        private readonly index: TextIndex,
        private readonly names: HighlightNames
    ) {}

    range(span: SpanPair): Range {
        const key = spanKey(span);
        let range = this.ranges.get(key);
        if (!range) {
            range = this.index.toRange(span[0], span[1]);
            this.ranges.set(key, range);
        }
        return range;
    }

    update(focused: SpanPair[], evidence: SpanPair[], original: SpanPair[]) {
        if (!highlightsSupported()) return;
        const focusedKeys = new Set(focused.map(spanKey));
        const others = evidence.filter((span) => !focusedKeys.has(spanKey(span)));
        const focus = new Highlight(...focused.map((span) => this.range(span)));
        focus.priority = FOCUS_PRIORITY;
        CSS.highlights.set(this.names.focus, focus);
        CSS.highlights.set(this.names.evidence, new Highlight(...others.map((span) => this.range(span))));
        CSS.highlights.set(this.names.original, new Highlight(...original.map((span) => this.range(span))));
    }

    pulse(span: SpanPair | null) {
        this.setOne(this.names.pulse, span, PULSE_PRIORITY);
    }

    moving(span: SpanPair | null) {
        this.setOne(this.names.moving, span, MOVING_PRIORITY);
    }

    private setOne(name: string, span: SpanPair | null, priority: number) {
        if (!highlightsSupported()) return;
        if (!span) return void CSS.highlights.delete(name);
        const highlight = new Highlight(this.range(span));
        highlight.priority = priority;
        CSS.highlights.set(name, highlight);
    }

    clear() {
        if (!highlightsSupported()) return;
        for (const name of Object.values(this.names)) CSS.highlights.delete(name);
    }
}

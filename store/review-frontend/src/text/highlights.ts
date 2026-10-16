import type { SpanPair } from '../model/record';
import type { TextIndex } from './TextIndex';

export interface HighlightNames {
    focus: string;
    evidence: string;
    /** The original's spans of the focused item, while the diff is shown. */
    original: string;
}

export const REVIEW_HIGHLIGHTS: HighlightNames = {
    focus: 'rv-focus',
    evidence: 'rv-evidence',
    original: 'rv-original',
};

const spanKey = ([start, end]: SpanPair) => `${start}:${end}`;

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
        focus.priority = 1;
        CSS.highlights.set(this.names.focus, focus);
        CSS.highlights.set(this.names.evidence, new Highlight(...others.map((span) => this.range(span))));
        CSS.highlights.set(this.names.original, new Highlight(...original.map((span) => this.range(span))));
    }

    clear() {
        if (!highlightsSupported()) return;
        CSS.highlights.delete(this.names.focus);
        CSS.highlights.delete(this.names.evidence);
        CSS.highlights.delete(this.names.original);
    }
}

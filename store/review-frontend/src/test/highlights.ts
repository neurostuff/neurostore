import { TextIndex } from '../text/TextIndex';

class FakeHighlight extends Set<AbstractRange> {
    priority = 0;
    type = 'highlight';

    constructor(...ranges: AbstractRange[]) {
        super(ranges);
    }
}

export function installHighlightAdapter() {
    const css = (globalThis.CSS ??= {} as typeof CSS) as { highlights?: Map<string, FakeHighlight> };
    css.highlights = new Map();
    (globalThis as { Highlight?: unknown }).Highlight = FakeHighlight;
}

export function registeredSpans(name: string, root: HTMLElement): [number, number][] {
    const index = TextIndex.build(root);
    const highlight = (CSS.highlights as unknown as Map<string, Set<Range>>).get(name);
    return [...(highlight ?? [])].map((range) => index.fromRange(range)!).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

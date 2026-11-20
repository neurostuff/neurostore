/** Marks content set beside the text, which is not part of it and holds no offsets. */
export const ASIDE = 'data-text-aside';
const inAside = (node: Node) => (node instanceof Element ? node : node.parentElement)?.closest?.(`[${ASIDE}]`) != null;

export class TextIndex {
    private readonly starts: number[] = [];
    private readonly startOf = new Map<Node, number>();

    private constructor(
        private readonly root: HTMLElement,
        private readonly nodes: Text[]
    ) {
        let offset = 0;
        for (const node of nodes) {
            this.starts.push(offset);
            this.startOf.set(node, offset);
            offset += node.data.length;
        }
    }

    static build(root: HTMLElement) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => (inAside(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
        });
        const nodes: Text[] = [];
        for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text);
        return new TextIndex(root, nodes);
    }

    private point(offset: number, isEnd: boolean): [Node, number] {
        if (this.nodes.length === 0) return [this.root, 0];
        let lo = 0;
        let hi = this.nodes.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            const start = this.starts[mid];
            if (start < offset || (!isEnd && start === offset)) lo = mid;
            else hi = mid - 1;
        }
        const node = this.nodes[lo];
        return [node, Math.min(Math.max(offset - this.starts[lo], 0), node.data.length)];
    }

    toRange(start: number, end: number): Range {
        const range = document.createRange();
        const from = this.point(start, false);
        range.selectNodeContents(from[0]);
        range.setStart(...from);
        range.setEnd(...this.point(end, true));
        return range;
    }

    fromPoint(node: Node, offset: number): number | null {
        if (!this.root.contains(node) || inAside(node)) return null;
        const start = this.startOf.get(node);
        if (start !== undefined) return start + offset;
        return this.indexedBefore(node, offset);
    }

    /** The offset just after the last index text node that ends at or before the point. */
    private indexedBefore(node: Node, offset: number): number {
        const probe = document.createRange();
        probe.setStart(node, offset);
        probe.collapse(true);
        let lo = 0;
        let hi = this.nodes.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            const text = this.nodes[mid];
            if (probe.comparePoint(text, text.length) <= 0) lo = mid + 1;
            else hi = mid;
        }
        return lo === 0 ? 0 : this.starts[lo - 1] + this.nodes[lo - 1].length;
    }

    fromRange(range: Range): [number, number] | null {
        const start = this.fromPoint(range.startContainer, range.startOffset);
        const end = this.fromPoint(range.endContainer, range.endOffset);
        return start === null || end === null ? null : [start, end];
    }

    textNodes(): readonly Text[] {
        return this.nodes;
    }
}

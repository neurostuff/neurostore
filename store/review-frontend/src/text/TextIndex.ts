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
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
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
        range.setStart(...this.point(start, false));
        range.setEnd(...this.point(end, true));
        return range;
    }

    fromPoint(node: Node, offset: number): number | null {
        if (!this.root.contains(node)) return null;
        const start = this.startOf.get(node);
        if (start !== undefined) return start + offset;
        const range = document.createRange();
        range.setStart(this.root, 0);
        range.setEnd(node, offset);
        return range.toString().length;
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

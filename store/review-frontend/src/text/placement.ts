export interface Place {
    left: number;
    top: number;
    height: number;
}

/** Where `rect`, in viewport coordinates, sits in the scroller's content, its left edge taken at `x`. */
export function inContent(scroller: HTMLElement, rect: DOMRect, x = rect.left): Place {
    const box = scroller.getBoundingClientRect();
    return {
        left: x - box.left + scroller.scrollLeft,
        top: rect.top - box.top + scroller.scrollTop,
        height: rect.height,
    };
}

export interface Placed {
    start: Place;
    end: Place;
    inTable: boolean;
}

const inTable = (node: Node) => (node instanceof Element ? node : node.parentElement)?.closest('table') != null;

/** Where the ends of `range` sit in the scroller's content, from its first and last rects. */
export function place(scroller: HTMLElement, range: Range): Placed | null {
    const rects = range.getClientRects();
    if (rects.length === 0) return null;
    const first = rects[0];
    const last = rects[rects.length - 1];
    return {
        start: inContent(scroller, first),
        end: inContent(scroller, last, last.right),
        inTable: inTable(range.startContainer) || inTable(range.endContainer),
    };
}

const samePlace = (a: Place, b: Place) => a.left === b.left && a.top === b.top && a.height === b.height;

export const samePlaced = (a: Placed | null, b: Placed | null) =>
    a === b ||
    (a !== null && b !== null && a.inTable === b.inTable && samePlace(a.start, b.start) && samePlace(a.end, b.end));

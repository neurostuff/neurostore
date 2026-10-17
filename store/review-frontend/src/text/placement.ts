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

/** Size of the remove control, and its gap from the text column. */
export const REMOVE_SIZE = 20;
const REMOVE_GAP = 4;

export interface Spot {
    left: number;
    top: number;
}

/** The remove control's corner: in the margin just right of the text column, centred on `end`'s line; the gap shrinks to fit before `marginRight`. */
export function removeSpot(end: Place, columnRight: number, marginRight: number): Spot {
    const gap = Math.min(REMOVE_GAP, Math.max(0, marginRight - columnRight - REMOVE_SIZE));
    return { left: columnRight + gap, top: end.top + (end.height - REMOVE_SIZE) / 2 };
}

export interface Placed {
    start: Place;
    end: Place;
    remove: Spot;
    inTable: boolean;
}

const inTable = (node: Node) => (node instanceof Element ? node : node.parentElement)?.closest('table') != null;

/** Where the ends of `range` sit in the scroller's content, from its first and last rects, and the remove control by them. `columnRight` is the text column's right edge in viewport coordinates. */
export function place(scroller: HTMLElement, range: Range, columnRight: number): Placed | null {
    const rects = range.getClientRects();
    if (rects.length === 0) return null;
    const first = rects[0];
    const last = rects[rects.length - 1];
    const box = scroller.getBoundingClientRect();
    const end = inContent(scroller, last, last.right);
    return {
        start: inContent(scroller, first),
        end,
        remove: removeSpot(
            end,
            columnRight - box.left + scroller.scrollLeft,
            scroller.scrollLeft + scroller.clientWidth
        ),
        inTable: inTable(range.startContainer) || inTable(range.endContainer),
    };
}

const samePlace = (a: Place, b: Place) => a.left === b.left && a.top === b.top && a.height === b.height;
const sameSpot = (a: Spot, b: Spot) => a.left === b.left && a.top === b.top;

export const samePlaced = (a: Placed | null, b: Placed | null) =>
    a === b ||
    (a !== null &&
        b !== null &&
        a.inTable === b.inTable &&
        samePlace(a.start, b.start) &&
        samePlace(a.end, b.end) &&
        sameSpot(a.remove, b.remove));

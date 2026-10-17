import type { SpanPair } from '../model/record';

const WORD = /[\p{L}\p{N}_]/u;
const SPACE = /\s/;

const isWord = (text: string, i: number) => i >= 0 && i < text.length && WORD.test(text[i]);

export function snapToWords(text: string, start: number, end: number): SpanPair | null {
    while (start < end && SPACE.test(text[start])) start++;
    while (end > start && SPACE.test(text[end - 1])) end--;
    if (start >= end) return null;
    while (isWord(text, start - 1) && isWord(text, start)) start--;
    while (isWord(text, end) && isWord(text, end - 1)) end++;
    return [start, end];
}

export type Edge = 'start' | 'end';

/** The span with its `edge` at `i`, held one character short of the other end so the two never cross. */
const withEdge = ([start, end]: SpanPair, edge: Edge, i: number): SpanPair =>
    edge === 'start' ? [Math.min(i, end - 1), end] : [start, Math.max(i, start + 1)];

/** The span with its `edge` dragged to `offset`, snapped to a word edge; the other end stays, and the two never cross. */
export function moveEdge(text: string, span: SpanPair, edge: Edge, offset: number): SpanPair {
    const snapped = snapToWords(text, ...withEdge(span, edge, offset));
    if (!snapped) return span;
    return edge === 'start' ? [snapped[0], span[1]] : [span[0], snapped[1]];
}

/** The span with its `edge` moved one word left or right; the other end stays, and the two never cross. */
export function stepEdge(text: string, span: SpanPair, edge: Edge, delta: 1 | -1): SpanPair {
    let i = edge === 'start' ? span[0] : span[1];
    const skip = (word: boolean) => {
        if (delta > 0) while (i < text.length && isWord(text, i) === word) i++;
        else while (i > 0 && isWord(text, i - 1) === word) i--;
    };
    const leavingWord = (edge === 'start') === delta > 0;
    skip(leavingWord);
    skip(!leavingWord);
    return moveEdge(text, span, edge, i);
}

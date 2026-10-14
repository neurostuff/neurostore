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

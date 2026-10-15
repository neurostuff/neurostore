/** The paper's characters, addressed by the units the ops and the bundle's spans use. */
export interface PaperText {
    readonly length: number;
    slice(start: number, end: number): string;
}

let indexed: { text: string; starts: number[] } | null = null;

/** Where each code point of `text` starts in UTF-16 code units, then the length; built once per text. */
function startsOf(text: string): number[] {
    if (indexed?.text !== text) {
        const starts: number[] = [];
        for (let unit = 0; unit < text.length;) {
            starts.push(unit);
            unit += text.codePointAt(unit)! > 0xffff ? 2 : 1;
        }
        starts.push(text.length);
        indexed = { text, starts };
    }
    return indexed.starts;
}

/** The UTF-16 position of a code point offset; past the end, the distance carries on. */
export function fromCodePoints(text: string, point: number): number {
    const starts = startsOf(text);
    const count = starts.length - 1;
    return point <= count ? starts[point] : text.length + (point - count);
}

/** The code point offset of a UTF-16 position, rounded down to the code point it is in. */
export function toCodePoints(text: string, unit: number): number {
    const starts = startsOf(text);
    const count = starts.length - 1;
    if (unit >= text.length) return count + (unit - text.length);
    let lo = 0;
    let hi = count;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (starts[mid] <= unit) lo = mid;
        else hi = mid - 1;
    }
    return lo;
}

export function codePointPaper(text: string): PaperText {
    const count = startsOf(text).length - 1;
    return { length: count, slice: (start, end) => text.slice(fromCodePoints(text, start), fromCodePoints(text, end)) };
}

export function utf16Paper(text: string): PaperText {
    return { length: text.length, slice: (start, end) => text.slice(start, end) };
}

const mapSpanOffsets = <T>(value: T, map: (offset: number) => number): T => {
    if (Array.isArray(value)) return value.map((item) => mapSpanOffsets(item, map)) as T;
    if (typeof value !== 'object' || value === null) return value;
    return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
            key,
            (key === 'start_char' || key === 'end_char') && typeof item === 'number'
                ? map(item)
                : mapSpanOffsets(item, map),
        ])
    ) as T;
};

/** `value` with every span offset in code points, as the contract has them, moved to UTF-16 code units. */
export const spansToUtf16 = <T>(text: string, value: T): T =>
    mapSpanOffsets(value, (point) => fromCodePoints(text, point));

/** `value` with every span offset in UTF-16 code units moved to code points, as the contract has them. */
export const spansToCodePoints = <T>(text: string, value: T): T =>
    mapSpanOffsets(value, (unit) => toCodePoints(text, unit));

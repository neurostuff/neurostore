interface TextExtent {
    start: number;
    end: number;
    contentEnd: number;
}

export interface HeadingBlock extends TextExtent {
    kind: 'heading';
    level: number;
    markerEnd: number;
}

export interface ParagraphBlock extends TextExtent {
    kind: 'paragraph';
}

export type TableCell = TextExtent;

export interface TableRow {
    start: number;
    end: number;
    cells: TableCell[];
}

export interface TableBlock extends TextExtent {
    kind: 'table';
    tableId: string;
    rows: TableRow[];
}

export type Block = HeadingBlock | ParagraphBlock | TableBlock;

export interface ParsedTable {
    table_id: string;
    label?: string;
}

export interface ParsedPaperLayout {
    bibliography?: { title?: string };
    tables?: ParsedTable[];
}

interface Line {
    start: number;
    end: number;
    body: string;
}

const HEADING = /^(#{1,6})[ \t]+(?=\S)/;
const isBlank = (line: Line) => line.body.trim() === '';

function splitLines(text: string): Line[] {
    const lines: Line[] = [];
    let start = 0;
    while (start < text.length) {
        const newline = text.indexOf('\n', start);
        const end = newline === -1 ? text.length : newline + 1;
        lines.push({ start, end, body: text.slice(start, newline === -1 ? end : newline) });
        start = end;
    }
    return lines;
}

function trimmedEnd(text: string, start: number, end: number) {
    let i = end;
    while (i > start && /\s/.test(text[i - 1])) i--;
    return i;
}

function escapeRegExp(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function locateTables(lines: Line[], tables: ParsedTable[]) {
    const found = new Map<number, { table: ParsedTable; rowLines: Line[] }>();
    let cursor = 0;
    for (const table of tables) {
        if (!table.label) continue;
        const label = new RegExp(`^\\s*${escapeRegExp(table.label)}\\.?\\s*$`);
        for (let i = cursor; i < lines.length; i++) {
            if (!label.test(lines[i].body)) continue;
            let j = i + 1;
            while (j < lines.length && lines[j].body.includes('\t')) j++;
            if (j > i + 1) {
                found.set(i + 1, { table, rowLines: lines.slice(i + 1, j) });
                cursor = j;
                break;
            }
        }
    }
    return found;
}

function tableBlock(text: string, table: ParsedTable, rowLines: Line[]): TableBlock {
    const rows = rowLines.map((line): TableRow => {
        const cells: TableCell[] = [];
        let start = line.start;
        for (const part of line.body.split('\t')) {
            const contentEnd = trimmedEnd(text, start, start + part.length);
            const end = Math.min(start + part.length + 1, line.end);
            cells.push({ start, end, contentEnd });
            start = end;
        }
        cells[cells.length - 1].end = line.end;
        return { start: line.start, end: line.end, cells };
    });
    const start = rowLines[0].start;
    const end = rowLines[rowLines.length - 1].end;
    return { kind: 'table', start, end, contentEnd: end, tableId: table.table_id, rows };
}

/**
 * The blocks of each paper's text, by its parsed paper: the text pane, the cards and every coordinate focus lay
 * out the same text, many times for each change.
 */
const laidOut = new WeakMap<ParsedPaperLayout, { text: string; blocks: Block[] }>();

/** The blocks of `text` as laid out under `parsedPaper`; laid out once for each text and paper, then shared. */
export function layoutText(text: string, parsedPaper: ParsedPaperLayout): Block[] {
    let held = laidOut.get(parsedPaper);
    if (held?.text !== text) laidOut.set(parsedPaper, (held = { text, blocks: layoutBlocks(text, parsedPaper) }));
    return held.blocks;
}

function layoutBlocks(text: string, parsedPaper: ParsedPaperLayout): Block[] {
    const lines = splitLines(text);
    const tables = locateTables(lines, parsedPaper.tables ?? []);
    const title = parsedPaper.bibliography?.title?.trim();
    const blocks: Block[] = [];

    let i = 0;
    while (i < lines.length) {
        const located = tables.get(i);
        if (located) {
            blocks.push(tableBlock(text, located.table, located.rowLines));
            i += located.rowLines.length;
            continue;
        }
        const line = lines[i];
        const marker = HEADING.exec(line.body);
        const isTitle = i === 0 && !!title && line.body.trim() === title;
        let j = i + 1;
        if (!marker && !isTitle) {
            while (j < lines.length && !isBlank(lines[j - 1]) && !tables.has(j) && !HEADING.test(lines[j].body)) j++;
        }
        while (j < lines.length && isBlank(lines[j]) && !tables.has(j)) j++;
        const start = line.start;
        const end = lines[j - 1].end;
        const contentEnd = trimmedEnd(text, start, end);
        if (marker || isTitle) {
            const level = marker ? marker[1].length : 1;
            blocks.push({
                kind: 'heading',
                start,
                end,
                contentEnd,
                level,
                markerEnd: start + (marker?.[0].length ?? 0),
            });
        } else {
            blocks.push({ kind: 'paragraph', start, end, contentEnd });
        }
        i = j;
    }
    return blocks;
}

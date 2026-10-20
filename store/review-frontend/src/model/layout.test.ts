import { layoutText, type HeadingBlock } from './layout';

const TEXT = [
    'A Title\n',
    '## Methods \n',
    '  \n',
    'We scanned 20 people.\n',
    'Second line.\n',
    '  \n',
    'Caption of the table\n',
    'Table 1. \n',
    'Region\tx\ty\n',
    'Insula\t1\t−2\n',
    'Footer text.\n',
    '### Results\n',
    'Done.',
].join('');

const parsedPaper = {
    bibliography: { title: 'A Title' },
    tables: [{ table_id: 'tbl_1', label: 'Table 1', number: '1', caption: 'Caption of the table' }],
};

describe('layoutText', () => {
    const blocks = layoutText(TEXT, parsedPaper);
    const slice = (start: number, end: number) => TEXT.slice(start, end);

    it('covers the text exactly once, in order', () => {
        expect(blocks.length).toBeGreaterThan(0);
        expect(blocks[0].start).toBe(0);
        blocks.slice(1).forEach((b, i) => expect(b.start).toBe(blocks[i].end));
        expect(blocks[blocks.length - 1].end).toBe(TEXT.length);
    });

    it('places the title and the section headings at their offsets', () => {
        const headings = blocks.filter((b) => b.kind === 'heading');
        expect(headings.map((h) => [h.level, slice(h.markerEnd, h.contentEnd)])).toEqual([
            [1, 'A Title'],
            [2, 'Methods'],
            [3, 'Results'],
        ]);
        expect(headings[1].start).toBe(TEXT.indexOf('## Methods'));
    });

    it('reads a single # as a level-1 heading', () => {
        const text = 'Untitled\n# Introduction\nFirst line.\n';
        const heading = layoutText(text, {})[1] as HeadingBlock;
        expect(heading).toMatchObject({ kind: 'heading', level: 1, start: text.indexOf('# Introduction') });
        expect(text.slice(heading.markerEnd, heading.contentEnd)).toBe('Introduction');
    });

    it('places a parsed table’s rows and cells at their offsets', () => {
        const tables = blocks.filter((b) => b.kind === 'table');
        expect(tables).toHaveLength(1);
        const [table] = tables;
        expect(table.tableId).toBe('tbl_1');
        expect(table.start).toBe(TEXT.indexOf('Region'));
        expect(table.rows.map((r) => r.cells.map((c) => slice(c.start, c.contentEnd)))).toEqual([
            ['Region', 'x', 'y'],
            ['Insula', '1', '−2'],
        ]);
        expect(slice(table.start, table.end)).toBe('Region\tx\ty\nInsula\t1\t−2\n');
    });

    it('splits prose into paragraphs at blank lines', () => {
        const prose = blocks.filter((b) => b.kind === 'paragraph').map((b) => slice(b.start, b.contentEnd));
        expect(prose).toEqual([
            'We scanned 20 people.\nSecond line.',
            'Caption of the table\nTable 1.',
            'Footer text.',
            'Done.',
        ]);
    });
});

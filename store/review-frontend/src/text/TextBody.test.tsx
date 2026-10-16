import { render } from '@testing-library/react';
import { hasFixture, loadFixture } from '../test/bundles';
import { layoutText, type ParsedPaperLayout } from '../model/layout';
import { TextBody } from './TextBody';
import { TextIndex } from './TextIndex';

const TEXT = 'A Title\n## Methods \n  \nWe scanned 20 people.\nTable 1. \nRegion\tx\n“Insula”\t−2\nDone.';
const PAPER = { bibliography: { title: 'A Title' }, tables: [{ table_id: 't1', label: 'Table 1' }] };

function renderBody(text: string, paper: ParsedPaperLayout) {
    const { container } = render(<TextBody text={text} blocks={layoutText(text, paper)} />);
    const root = container.firstElementChild as HTMLElement;
    return { root, index: TextIndex.build(root) };
}

describe('TextBody', () => {
    it('renders the text exactly once', () => {
        const { root } = renderBody(TEXT, PAPER);
        expect(root.textContent).toBe(TEXT);
    });

    it('renders headings and table rows as elements', () => {
        const { root } = renderBody(TEXT, PAPER);
        expect([...root.querySelectorAll('h1, h2')].map((h) => [h.tagName, h.textContent?.trim()])).toEqual([
            ['H1', 'A Title'],
            ['H2', '## Methods'],
        ]);
        const rows = [...root.querySelectorAll('tr')].map((tr) => [...tr.cells].map((td) => td.textContent?.trim()));
        expect(rows).toEqual([
            ['Region', 'x'],
            ['“Insula”', '−2'],
        ]);
    });

    it('maps every text offset to the DOM and back', () => {
        const { index } = renderBody(TEXT, PAPER);
        for (let start = 0; start < TEXT.length; start++) {
            for (const end of [start + 1, Math.min(start + 7, TEXT.length), TEXT.length]) {
                const range = index.toRange(start, end);
                expect(range.toString()).toBe(TEXT.slice(start, end));
                expect(index.fromRange(range)).toEqual([start, end]);
            }
        }
    });

    it('maps a range whose boundaries sit on elements', () => {
        const { root, index } = renderBody(TEXT, PAPER);
        const table = root.querySelector('table')!;
        const range = document.createRange();
        range.selectNode(table);
        expect(index.fromRange(range)).toEqual([TEXT.indexOf('Region'), TEXT.indexOf('Done.')]);
        range.selectNodeContents(root);
        expect(index.fromRange(range)).toEqual([0, TEXT.length]);
    });

    it('returns null for a range outside the text', () => {
        const { index } = renderBody(TEXT, PAPER);
        const range = document.createRange();
        range.selectNodeContents(document.body.appendChild(document.createElement('p')));
        expect(index.fromRange(range)).toBeNull();
    });

    it.skipIf(!hasFixture('25Czf8TcaxDS'))('lays out a real paper with its tables', () => {
        const bundle = loadFixture('25Czf8TcaxDS');
        const { root } = renderBody(bundle.text, bundle.parsed_paper as ParsedPaperLayout);
        expect(root.textContent).toBe(bundle.text);
        expect(root.querySelectorAll('table')).toHaveLength(9);
        const levels = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((tag) => root.querySelectorAll(tag).length);
        expect(levels).toEqual([1, 8, 21, 9, 7, 0]);
        expect(root.querySelector('h1')).toHaveTextContent(/^Differential neural correlates/);
    });
});

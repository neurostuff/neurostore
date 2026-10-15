import { layoutText, type ParsedPaperLayout, type TableBlock } from '../text/layout';
import {
    COORD_TEXT,
    coordinateBundle,
    CUNEUS,
    FACES,
    HOUSES,
    INSULA,
    key,
    LOCALIZER,
    PARSE,
    point,
    PRECUNEUS,
    revision,
    SCRAMBLED,
    span,
} from '../test/coordinates';
import { analysesBeside, currentAnalyses, guidedOrder, pointSpan, successor } from './coordinates';

const bundle = coordinateBundle();
const blocks = layoutText(COORD_TEXT, bundle.parsed_paper as ParsedPaperLayout);
const tableBlock = (id: string) => blocks.find((b): b is TableBlock => b.kind === 'table' && b.tableId === id)!;
const textOf = ([start, end]: [number, number]) => COORD_TEXT.slice(start, end);

describe('the analyses a step shows', () => {
    it('are the revision’s when the review has one, else the original parse’s', () => {
        expect(currentAnalyses(bundle)).toEqual(PARSE.analyses);
        const revised = coordinateBundle({ coordinate_revision: revision([HOUSES]) });
        expect(currentAnalyses(revised)).toEqual([HOUSES]);
    });

    it('come in parse order, with analyses that have no points last and only when shown', () => {
        const analyses = [SCRAMBLED, FACES, HOUSES, LOCALIZER];
        expect(guidedOrder(analyses, false).map((a) => a.key)).toEqual([FACES.key, HOUSES.key, LOCALIZER.key]);
        expect(guidedOrder(analyses, true).map((a) => a.key)).toEqual([
            FACES.key,
            HOUSES.key,
            LOCALIZER.key,
            SCRAMBLED.key,
        ]);
    });
});

describe('where each analysis sits in the text', () => {
    it('beside its table, or beside the block holding its first span', () => {
        const beside = analysesBeside(blocks, PARSE.analyses!);
        expect(beside.get(tableBlock('t1').start)?.map((a) => a.key)).toEqual([FACES.key, HOUSES.key]);
        expect(beside.get(tableBlock('t2').start)?.map((a) => a.key)).toEqual([SCRAMBLED.key]);
        const paragraph = blocks.find((b) => b.start <= span('x = 4').start_char && span('x = 4').end_char <= b.end)!;
        expect(paragraph.kind).toBe('paragraph');
        expect(beside.get(paragraph.start)?.map((a) => a.key)).toEqual([LOCALIZER.key]);
    });

    it('after the text when it has no table or span the text holds', () => {
        const lost = { ...HOUSES, key: key(0xe5), table_id: 'missing' };
        const unspanned = { ...LOCALIZER, key: key(0xf6), text_spans: [], points: [point([4, -60, 40])] };
        expect(
            analysesBeside(blocks, [lost, unspanned])
                .get('end')
                ?.map((a) => a.key)
        ).toEqual([lost.key, unspanned.key]);
    });
});

describe('the span a point is read from', () => {
    it('is the table row printing its coordinates, minus signs and all', () => {
        expect(textOf(pointSpan(COORD_TEXT, PRECUNEUS, tableBlock('t1'))!)).toBe('Precuneus\t4\t−60\t40\t5.1');
        expect(textOf(pointSpan(COORD_TEXT, INSULA, tableBlock('t1'))!)).toBe('Insula\t-36\t20\t2\t4.2');
        expect(textOf(pointSpan(COORD_TEXT, CUNEUS, tableBlock('t1'))!)).toBe('Cuneus\t10\t-80\t12\t3.3');
    });

    it('is the point’s own text span when it has one', () => {
        expect(textOf(pointSpan(COORD_TEXT, LOCALIZER.points![0], undefined)!)).toBe('x = 4, y = -60, z = 40');
    });

    it('is unknown for a point no row prints', () => {
        expect(pointSpan(COORD_TEXT, point([1, 2, 3]), tableBlock('t1'))).toBeUndefined();
    });
});

describe('the analysis that replaces the focused one', () => {
    const before = PARSE.analyses!;
    const edited = { ...FACES, key: key(0x1a1), derived_from: [FACES.key], points: [PRECUNEUS] };

    it('is itself while its key stands', () => {
        expect(successor(before, before, FACES.key)).toBe(FACES.key);
    });

    it('is the new analysis derived from it, the first part of a split', () => {
        const first = { ...edited, key: key(0x2a1) };
        const second = { ...edited, key: key(0x3a1), points: [INSULA] };
        expect(successor(before, [first, second, HOUSES], FACES.key)).toBe(first.key);
    });

    it('follows an analysis already derived, through the originals it comes from', () => {
        const part = { ...edited, key: key(0x2a1), points: [PRECUNEUS] };
        const other = { ...edited, key: key(0x3a1), points: [INSULA] };
        const again = { ...other, key: key(0x4a1), points: [{ ...INSULA, label: 'Insula' }] };
        expect(successor([part, other, HOUSES], [part, again, HOUSES], other.key)).toBe(again.key);
    });

    it('is none when the analysis was omitted', () => {
        expect(successor(before, [HOUSES, LOCALIZER, SCRAMBLED], FACES.key)).toBeUndefined();
    });
});

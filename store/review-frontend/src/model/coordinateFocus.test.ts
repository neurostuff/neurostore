import { declaredOf } from '../store/declared';
import type { ReviewBundle } from '../contract/generated/review-bundle';
import {
    coordinateBundle,
    key,
    point,
    PROSE,
    PROSE_OTHER,
    PROSE_SENTENCE,
    PROSE_TEXT,
    proseAt,
    proseBundle,
    SCRAMBLED,
} from '../test/coordinates';
import { analysisPlace, coordinateSpans } from './coordinateFocus';
import { layoutText, type ParsedPaperLayout } from './layout';
import { buildRecordIndex } from './record';

const TEXT = PROSE_TEXT;
const at = proseAt;
const SENTENCE = PROSE_SENTENCE;
const OTHER = PROSE_OTHER;

function paper(options: Parameters<typeof proseBundle>[0] = {}) {
    const bundle = proseBundle(options);
    return { bundle, index: buildRecordIndex(bundle, declaredOf) };
}

const spansOf = ({ bundle, index }: ReturnType<typeof paper>, focusPoint: number | null = null) =>
    coordinateSpans(bundle, { analysis: PROSE.key, point: focusPoint, selected: [] }, index);

describe('a text analysis with no spans of its own', () => {
    it('is found by the evidence of its coordinate_sets entry', () => {
        expect(spansOf(paper())).toEqual([SENTENCE]);
    });

    it('else by the spans of the record Analysis that names it', () => {
        expect(spansOf(paper({ sets: false }))).toEqual([OTHER]);
    });

    it('else by its points’ x, y and z as the text prints them, minus signs and spaces as printed', () => {
        expect(spansOf(paper({ sets: false, named: false }))).toEqual([at('26, Y = − 8, Z = 0')]);
    });

    it('a focused point is found where the record reports its analysis, as the analysis is', () => {
        expect(spansOf(paper(), 0)).toEqual([SENTENCE]);
    });

    it('a focused point the record does not report is found by its x, y and z', () => {
        expect(spansOf(paper({ sets: false, named: false }), 0)).toEqual([at('26, Y = − 8, Z = 0')]);
    });

    it('a revised analysis is found by the coordinate_sets entry of the original it comes from', () => {
        const { bundle, index } = paper({ named: false });
        const revised = { ...PROSE, key: key(0x7f), derived_from: [PROSE.key] };
        const spans = coordinateSpans(
            { ...bundle, coordinate_revision: { analyses: [revised] } as ReviewBundle['coordinate_revision'] },
            { analysis: revised.key, point: null, selected: [] },
            index
        );
        expect(spans).toEqual([SENTENCE]);
    });

    it('has no span when nothing reports it', () => {
        expect(spansOf(paper({ sets: false, named: false, coordinates: [1, 2, 3] }))).toEqual([]);
    });

    it('sits beside the paragraph its span is in', () => {
        const { bundle, index } = paper();
        const blocks = layoutText(TEXT, bundle.parsed_paper as ParsedPaperLayout);
        const place = analysisPlace(bundle, index, blocks, PROSE);
        expect(blocks.find((b) => b.start === place)?.start).toBe(
            blocks.find((b) => b.start <= SENTENCE[0] && SENTENCE[0] < b.end)?.start
        );
        const lost = paper({ sets: false, named: false, coordinates: [1, 2, 3] });
        expect(analysisPlace(lost.bundle, lost.index, blocks, PROSE)).toBeUndefined();
    });
});

describe('a table analysis', () => {
    it('is not looked for in the prose when its table prints none of its points', () => {
        const bundle = coordinateBundle();
        const analysis = { ...SCRAMBLED, points: [point([4, -60, 40])] };
        const revised = {
            ...bundle,
            coordinate_revision: { analyses: [analysis] } as ReviewBundle['coordinate_revision'],
        };
        const index = buildRecordIndex(revised, declaredOf);
        expect(coordinateSpans(revised, { analysis: analysis.key, point: null, selected: [] }, index)).toEqual([]);
        expect(coordinateSpans(revised, { analysis: analysis.key, point: 0, selected: [] }, index)).toEqual([]);
    });
});

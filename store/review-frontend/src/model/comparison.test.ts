import type { ReviewBundle } from '../contract/generated/review-bundle';
import { hasFixture, loadFixture } from '../test/bundles';
import { comparisonBundle } from '../test/comparisons';
import golden from '../test/golden/bundle.json';
import { comparisonOf, fieldOrder, otherFields, type TermRow } from './comparison';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildRecordIndex } from './record';

const index = buildRecordIndex(comparisonBundle());
const of = (id: string) => comparisonOf(index, index.entity(id)!);
const levels = (entries: TermRow['positive']) => entries.map((entry) => entry.level);

describe('what an analysis compares', () => {
    it('gives one row per term, in the order each term first appears, its cells sorted by direction', () => {
        const { rows } = of('a_held');
        expect(rows.map((r) => [r.term, r.termLabel])).toEqual([
            ['trm_status', 'status'],
            ['trm_drug', 'drug'],
            ['trm_choice', 'choice'],
        ]);
        expect(levels(rows[0].positive)).toEqual(['Pos']);
        expect(levels(rows[0].negative)).toEqual(['Neg']);
        expect(levels(rows[1].held)).toEqual(['On']);
        expect(levels(rows[2].held)).toEqual(['Low']);
    });

    it('gives each level its cell and the cell’s slot keys', () => {
        expect(of('a_held').rows[0]?.negative[0]).toEqual({
            cell: 1,
            level: 'Neg',
            slots: {
                term: 'slot:a_held:effect.cells[#1].term',
                level: 'slot:a_held:effect.cells[#1].level',
                direction: 'slot:a_held:effect.cells[#1].direction',
                label: 'slot:a_held:effect.cells[#1].label',
            },
        });
    });

    it('puts a cell with no direction under missing, and an undirected one under either', () => {
        const [status] = of('a_unsigned').rows;
        expect(levels(status.positive)).toEqual(['Pos']);
        expect(levels(status.missing)).toEqual(['Neg']);
        expect(levels(of('a_omni').rows[2].either)).toEqual(['Low', 'Mid', 'High']);
    });

    it('says which way a continuous term goes: up, down, either way, or missing', () => {
        expect(of('a_mod').rows.map((r) => r.continuous)).toEqual(['up', 'down']);
        expect(of('a_reg').rows.map((r) => r.continuous)).toEqual(['missing', 'missing', 'missing', 'missing']);
        expect(of('a_reg').rows[0].missing.map((entry) => entry.level)).toEqual([undefined]);
        expect(of('a_held').rows.map((r) => r.continuous)).toEqual([undefined, undefined, undefined]);
    });

    describe('its headline, by the effect’s kind', () => {
        it.each([
            ['a contrast, within its held levels', 'a_held', { text: 'Pos > Neg', qualifier: 'within On, at Low' }],
            ['a contrast with several levels on one side', 'a_multi', { text: 'CueA and CueB > CueC' }],
            ['a contrast missing a side', 'a_unsigned', { text: 'Pos > ?' }],
            ['an interaction', 'a_inter', { text: '(G1 − G2) × (Wide − Narrow)' }],
            ['an interaction with many levels a side', 'a_many', { text: '(G1 − G2) × (4 levels − 4 levels)' }],
            ['an omnibus', 'a_omni', { text: 'any difference among status × drug × choice' }],
            ['a regression of more than three terms', 'a_reg', { text: 'brain measure ~ 4 terms' }],
            ['a parametric modulation of up to three', 'a_mod', { text: 'brain measure ~ score A + score B' }],
            ['a simple effect', 'a_simple', { text: 'Pos' }],
            ['a simple effect that is less', 'a_simple_less', { text: '− Neg' }],
        ])('%s', (_, id, headline) => {
            expect(of(id).headline).toEqual(headline);
        });

        it('is none where the effect has no kind, and the rows stay', () => {
            const { headline, rows } = of('a_nokind');
            expect(headline).toBeNull();
            expect(rows).toHaveLength(1);
        });
    });

    it('shows a term’s cells greater, less, held, either way, missing, whatever their order in the record', () => {
        const [status] = of('a_mixed').rows;
        expect(levels(status.positive)).toEqual(['Pos']);
        expect(
            fieldOrder(index, index.entity('a_mixed')!)
                .map((slot) => slot.key)
                .slice(0, 4)
        ).toEqual([
            'slot:a_mixed:effect.cells[#2].direction',
            'slot:a_mixed:effect.cells[#0].direction',
            'slot:a_mixed:effect.cells[#1].direction',
            'slot:a_mixed:name',
        ]);
    });

    it('reads a continuous term going either way, and a term with no type and no levels as continuous', () => {
        expect(of('a_either').rows.map((r) => [r.termLabel, r.continuous])).toEqual([
            ['score C', 'either'],
            ['untyped score', 'up'],
        ]);
    });

    it('leaves the cells’ slots out of an analysis’s other fields, and keeps every slot of any other entity', () => {
        const analysis = index.entity('a_held')!;
        expect(otherFields(analysis).map((slot) => slot.path)).toEqual(
            analysis.slots.map((slot) => slot.path).filter((p) => !p.startsWith('effect.cells'))
        );
        expect(otherFields(analysis)).toBe(otherFields(analysis));
        expect(otherFields(index.entity('grp_a')!)).toBe(index.entity('grp_a')!.slots);
    });

    it('is worked out once for each index and analysis', () => {
        const analysis = index.entity('a_inter')!;
        expect(comparisonOf(index, analysis)).toBe(comparisonOf(index, analysis));
        expect(comparisonOf(buildRecordIndex(comparisonBundle()), analysis)).not.toBe(comparisonOf(index, analysis));
    });
});

const localFixtures = (): string[] => {
    const listing = path.resolve(__dirname, '../../fixtures/index.json');
    try {
        return (JSON.parse(readFileSync(listing, 'utf8')) as { id: string }[]).map(({ id }) => id).filter(hasFixture);
    } catch {
        return [];
    }
};

/** The cells of each analysis of `bundle` the rows hold, and how many cells each analysis has. */
function coverage(bundle: ReviewBundle) {
    const indexed = buildRecordIndex(bundle);
    return indexed.entities
        .filter((entity) => entity.entityClass === 'Analysis')
        .map((analysis) => {
            const cells = new Set(
                analysis.slots.flatMap((slot) => /^effect\.cells\[#(\d+)\]\./.exec(slot.path)?.[1] ?? [])
            );
            const held = comparisonOf(indexed, analysis).rows.flatMap((r) =>
                [r.positive, r.negative, r.held, r.either, r.missing].flat().map((entry) => String(entry.cell))
            );
            return { analysis: analysis.id, held: held.toSorted(), cells: [...cells].toSorted() };
        });
}

describe('every cell in exactly one row', () => {
    const bundles: [string, () => ReviewBundle][] = [
        ['the golden bundle', () => golden as unknown as ReviewBundle],
        ['the synthetic shapes', () => comparisonBundle()],
        ...localFixtures().map((id): [string, () => ReviewBundle] => [
            `the local fixture ${id}`,
            () => loadFixture(id),
        ]),
    ];
    it.each(bundles)('%s', (_, bundle) => {
        const analyses = coverage(bundle());
        expect(analyses.filter(({ cells }) => cells.length > 0).length).toBeGreaterThan(0);
        for (const { analysis, held, cells } of analyses) expect(held, analysis).toEqual(cells);
    });
});

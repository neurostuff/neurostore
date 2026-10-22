import { descriptionOf } from '../model/schema';
import { GOLDEN_SCHEMAS } from '../test/goldenSchemas';
import { firstSentence, inProse } from './fieldHint';

describe('a description’s first sentence', () => {
    it.each([
        ['One. Two.', 'One.'],
        ['Only one, with no stop', 'Only one, with no stop'],
        ['Values such as e.g. 2.5 count. The rest.', 'Values such as e.g. 2.5 count.'],
        ['A line\nthen another.', 'A line'],
    ])('of %j is %j', (description, first) => {
        expect(firstSentence(description)).toBe(first);
    });
});

const prose = (className: string, path: string) => inProse(descriptionOf(className, path)!);

describe('a description in prose', () => {
    it('says a code class name and a code field in words', () => {
        expect(prose('FactorLevel', 'order')).toContain('It carries an ordering effect cells cannot');
    });

    it('keeps the case of example values in code', () => {
        expect(prose('LatentDecompositionDetails', 'component_id')).toContain('commonly an index such as IC12 or LV1');
        expect(prose('CategoryDistribution', 'category')).toContain('female, left-handed, Hispanic or Latino');
        expect(prose('Task', 'paradigm')).toContain('Stroop task for an emotional Stroop task');
    });

    it('says a bare Class.field and a bare snake_case name in words', () => {
        const settings = (GOLDEN_SCHEMAS['extraction-record'].$defs as Record<string, { description: string }>)
            .InferenceSettings.description;
        expect(inProse(settings)).toContain('belongs to the tested effect and lives in effect statistic.');
        expect(prose('ExtractedAllocation', 'value')).toBe(
            'Extracted or generated value. Populate when extraction status is extracted; omit when it is not reported.'
        );
        expect(prose('Analysis', 'spatial_scope')).toContain('The spatial scope refers to what voxels were modelled');
    });

    it('leaves out the developer references that are whole clauses', () => {
        expect(prose('Evidence', 'unlocated_quotes')).toContain(
            'could place in the source text. Omitted where none were, so its presence is the claim.'
        );
        expect(prose('ModelTerm', 'type')).toContain('let the cells carry the direction. Collapsed into one');
        const source = prose('Analysis', 'source_table_analysis');
        expect(source).toContain('parsed analysis key in neuroimaging-paper-parse. Derived from what was extracted');
        expect(source).not.toContain('#<h>');
    });

    it('keeps a developer reference inside a clause', () => {
        expect(prose('Effect', 'kind')).toContain('by the ordered steps of extraction-readme.md §3, so a kind');
    });
});

import { GOLDEN_SCHEMAS } from '../goldenSchemas';

const properties = (className: string) => {
    const defs = GOLDEN_SCHEMAS['extraction-record'].$defs as Record<string, { properties: Record<string, unknown> }>;
    return Object.keys(defs[className].properties);
};

const sorted = (names: string[]) => names.every((name, i) => i === 0 || names[i - 1] <= name);

// The served schema lists each class's properties alphabetically until the study_schema change that keeps them in
// LinkML order (an open study_schema PR) is in the pinned version; this runs, with no edit, once the golden copy
// of the schema comes from that version.
describe.skipIf(sorted(properties('Group')))('the extraction-record golden keeps the LinkML order (D96)', () => {
    it('lists Group’s properties as study_schema declares them', () => {
        const names = properties('Group').filter((name) => name !== 'stable_id' && name !== 'local_id');
        const declared = [
            'name',
            'description',
            'species',
            'arm',
            'approached_count',
            'acquired_count',
            'excluded_count',
            'inclusion_criteria',
            'age_mean',
            'age_standard_deviation',
            'age_minimum',
            'age_unit',
        ];
        expect(names.filter((name) => declared.includes(name))).toEqual(declared);
    });
});

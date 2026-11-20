import { descriptionOf } from './schema';

describe('a field’s description in the extraction record schema', () => {
    it('is its property’s, for a top-level field', () => {
        expect(descriptionOf('MRI', 'mr_acquisition_type')).toBe(
            'Acquisition dimensionality, such as 2D or 3D; useful for distinguishing protocols with materially different spatial sampling.'
        );
    });

    it.each([
        ['Analysis', 'groups[#0].n', /^Number of participants from this cohort included in this analysis\./],
        ['Analysis', 'effect.cells[#1].direction', /^How this cell entered the contrast: the weight's sign/],
        ['Group', 'sex_distribution[#2].percentage', /^Percentage of the relevant group in this category\.$/],
    ])('is its leaf’s, for %s %s', (className, path, description) => {
        expect(descriptionOf(className, path)).toMatch(description);
    });

    it('is the list’s, for a list item', () => {
        expect(descriptionOf('Group', 'race_distribution[#0]')).toBe(
            'Aggregate racial distribution using the study-reported category labels.'
        );
    });

    it.each([
        ['Analysis', 'local_id'],
        ['Analysis', 'no_such_field'],
        ['Analysis', 'groups[#0].no_such_field'],
        ['NoSuchClass', 'name'],
    ])('is undefined where %s %s has none', (className, path) => {
        expect(descriptionOf(className, path)).toBeUndefined();
    });
});

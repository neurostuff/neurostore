import { defaultExclusionTags, ENeurosynthTagIds } from 'stores/projects/ProjectStore.consts';
import { getDefaultExclusionTag } from './CurationPopupExclusionSelector.helpers';

describe('getDefaultExclusionTag', () => {
    it('uses Duplicate during prisma identification', () => {
        expect(getDefaultExclusionTag(true, 'identification').id).toBe(ENeurosynthTagIds.DUPLICATE_EXCLUSION_ID);
    });

    it('uses Irrelevant during prisma screening', () => {
        expect(getDefaultExclusionTag(true, 'screening').id).toBe(ENeurosynthTagIds.IRRELEVANT_EXCLUSION_ID);
    });

    it('uses Out of scope during prisma eligibility', () => {
        expect(getDefaultExclusionTag(true, 'eligibility').id).toBe(ENeurosynthTagIds.OUT_OF_SCOPE_EXCLUSION_ID);
    });

    it('uses the generic exclude tag outside prisma', () => {
        expect(getDefaultExclusionTag(false, undefined)).toEqual(defaultExclusionTags.exclusion);
    });
});

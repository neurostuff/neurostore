import { ITag } from 'pages/Curation/Curation.types';
import { defaultExclusionTags, ENeurosynthTagIds } from 'stores/projects/ProjectStore.consts';

export const getDefaultExclusionTag = (
    isPrisma: boolean,
    prismaPhase: 'identification' | 'screening' | 'eligibility' | undefined
): ITag => {
    if (isPrisma && prismaPhase === 'identification') {
        return {
            id: ENeurosynthTagIds.DUPLICATE_EXCLUSION_ID,
            label: 'Duplicate',
            isExclusionTag: true,
            isAssignable: true,
        };
    }

    if (isPrisma && prismaPhase === 'screening') {
        return {
            id: ENeurosynthTagIds.IRRELEVANT_EXCLUSION_ID,
            label: 'Irrelevant',
            isExclusionTag: true,
            isAssignable: true,
        };
    }

    if (isPrisma && prismaPhase === 'eligibility') {
        return {
            id: ENeurosynthTagIds.OUT_OF_SCOPE_EXCLUSION_ID,
            label: 'Out of scope',
            isExclusionTag: true,
            isAssignable: true,
        };
    }

    return defaultExclusionTags.exclusion;
};

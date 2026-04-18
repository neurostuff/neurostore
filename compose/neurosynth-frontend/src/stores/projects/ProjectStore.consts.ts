export enum ENeurosynthSourceIds {
    NEUROSTORE = 'neurosynth_neurostore_id_source',
    PUBMED = 'neurosynth_pubmed_id_source',
    SCOPUS = 'neurosynth_scopus_id_source',
    WEBOFSCIENCE = 'neurosynth_web_of_science_id_source',
    PSYCINFO = 'neurosynth_psycinfo_id_source',
    SLEUTH = 'neurosynth_sleuth_id_source',
    REFERENCEMANAGER = 'neurosynth_reference_manager_id_source',
}

export enum ENeurosynthTagIds {
    UNTAGGED_TAG_ID = 'neurosynth_untagged_tag', // default info tag
    NEEDS_REVIEW_TAG_ID = 'neurosynth_needs_review_tag', // default info tag
    UNCATEGORIZED_ID = 'neurosynth_uncategorized_tag', // default info tag

    DUPLICATE_EXCLUSION_ID = 'neurosynth_duplicate_exclusion', // default exclusion (prisma)
    IRRELEVANT_EXCLUSION_ID = 'neurosynth_irrelevant_exclusion', // default exclusion (prisma)
    REPORTS_NOT_RETRIEVED_EXCLUSION_ID = 'neurosynth_reports_not_retrieved_exclusion', // default exclusion (prisma)
    OUT_OF_SCOPE_EXCLUSION_ID = 'neurosynth_out_of_scope_exclusion', // default exclusion (prisma)
    INSUFFICIENT_DETAIL_EXCLUSION_ID = 'neurosynth_insufficient_detail_exclusion', // default exclusion (prisma)
    LIMITED_RIGOR_EXCLUSION_ID = 'neurosynth_limited_rigor', // default exclusion (prisma)
    EXCLUDE_EXCLUSION_ID = 'neurosynth_exclude_exclusion', // default exclusion
}

export const PRISMAEligibilityExclusionTags = {
    [ENeurosynthTagIds.REPORTS_NOT_RETRIEVED_EXCLUSION_ID]: {
        id: ENeurosynthTagIds.REPORTS_NOT_RETRIEVED_EXCLUSION_ID,
        label: 'Reports not retrieved',
        isExclusionTag: true,
        isAssignable: true,
    },
    [ENeurosynthTagIds.INSUFFICIENT_DETAIL_EXCLUSION_ID]: {
        id: ENeurosynthTagIds.INSUFFICIENT_DETAIL_EXCLUSION_ID,
        label: 'Insufficient Details',
        isExclusionTag: true,
        isAssignable: true,
    },
    [ENeurosynthTagIds.LIMITED_RIGOR_EXCLUSION_ID]: {
        id: ENeurosynthTagIds.LIMITED_RIGOR_EXCLUSION_ID,
        label: 'Limited Rigor',
        isExclusionTag: true,
        isAssignable: true,
    },
    [ENeurosynthTagIds.OUT_OF_SCOPE_EXCLUSION_ID]: {
        id: ENeurosynthTagIds.OUT_OF_SCOPE_EXCLUSION_ID,
        label: 'Out of scope',
        isExclusionTag: true,
        isAssignable: true,
    },
};

export const defaultExclusionTags = {
    exclusion: {
        id: ENeurosynthTagIds.EXCLUDE_EXCLUSION_ID,
        label: 'Exclude',
        isExclusionTag: true,
        isAssignable: true,
    },
    duplicate: {
        id: ENeurosynthTagIds.DUPLICATE_EXCLUSION_ID,
        label: 'Duplicate',
        isExclusionTag: true,
        isAssignable: true,
    },
};

export const defaultInfoTags = {
    untagged: {
        id: ENeurosynthTagIds.UNTAGGED_TAG_ID,
        label: 'Untagged studies',
        isExclusionTag: false,
        isAssignable: false,
    },
    uncategorized: {
        id: ENeurosynthTagIds.UNCATEGORIZED_ID,
        label: 'Uncategorized Studies',
        isExclusionTag: false,
        isAssignable: false,
    },
    needsReview: {
        id: ENeurosynthTagIds.NEEDS_REVIEW_TAG_ID,
        label: 'Needs Review',
        isExclusionTag: false,
        isAssignable: false,
    },
};

export const defaultIdentificationSources = {
    neurostore: {
        id: ENeurosynthSourceIds.NEUROSTORE,
        label: 'Neurostore',
    },
    pubmed: {
        id: ENeurosynthSourceIds.PUBMED,
        label: 'PubMed',
    },
    scopus: {
        id: ENeurosynthSourceIds.SCOPUS,
        label: 'Scopus',
    },
    webOfScience: {
        id: ENeurosynthSourceIds.WEBOFSCIENCE,
        label: 'Web of Science',
    },
    psycInfo: {
        id: ENeurosynthSourceIds.PSYCINFO,
        label: 'PsycInfo',
    },
    sleuth: {
        id: ENeurosynthSourceIds.SLEUTH,
        label: 'Sleuth',
    },
    referenceManager: {
        id: ENeurosynthSourceIds.REFERENCEMANAGER,
        label: 'Reference Manager',
    },
};

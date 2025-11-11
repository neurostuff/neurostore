import { ICurationColumn } from 'pages/Curation/Curation.types';
import { useProjectCurationColumns } from 'pages/Project/store/ProjectStore';
import { ENeurosynthTagIds } from 'pages/Project/store/ProjectStore.types';
import { useEffect, useState } from 'react';

export interface ICurationSummary {
    total: number;
    included: number;
    uncategorized: number;
    excluded: number;
    needsReview: number;
}

export const getCurationSummary = (curationColumns: ICurationColumn[]) => {
    const numTotalStudies = (curationColumns || []).reduce((acc, curr) => acc + curr.stubStudies.length, 0);

    // all included studies are in the last column
    const includedStudiesCol = curationColumns[curationColumns.length - 1];
    const numIncludedStudes = !includedStudiesCol ? 0 : includedStudiesCol.stubStudies.length;
    const numExcludedStudies = curationColumns.reduce(
        (acc, curr) => acc + curr.stubStudies.filter((study) => !!study.exclusionTagId).length,
        0
    );
    const numNeedsReviewStudies = curationColumns.reduce(
        (acc, curr) =>
            acc +
            curr.stubStudies.filter((study) =>
                study.tags.some((tag) => tag.id === ENeurosynthTagIds.NEEDS_REVIEW_TAG_ID)
            ).length,
        0
    );
    const numUncategorizedStudies = numTotalStudies - numIncludedStudes - numExcludedStudies;

    return {
        total: numTotalStudies,
        included: numIncludedStudes,
        uncategorized: numUncategorizedStudies,
        excluded: numExcludedStudies,
        needsReview: numNeedsReviewStudies,
    };
};

const useGetCurationSummary = () => {
    const columns = useProjectCurationColumns();

    const [curationSummary, setCurationSummary] = useState<ICurationSummary>({
        total: 0,
        included: 0,
        uncategorized: 0,
        excluded: 0,
        needsReview: 0,
    });

    useEffect(() => {
        setCurationSummary(() => getCurationSummary(columns || []));
    }, [columns]);

    return { ...curationSummary };
};

export default useGetCurationSummary;

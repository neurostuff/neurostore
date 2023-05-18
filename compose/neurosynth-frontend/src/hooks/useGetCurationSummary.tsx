import { useProjectCurationColumns } from 'pages/Projects/ProjectPage/ProjectStore';
import { useEffect, useState } from 'react';

export interface ICurationSummary {
    total: number;
    included: number;
    uncategorized: number;
    excluded: number;
}

const useGetCurationSummary = () => {
    const columns = useProjectCurationColumns();

    const [curationSummary, setCurationSummary] = useState<ICurationSummary>({
        total: 0,
        included: 0,
        uncategorized: 0,
        excluded: 0,
    });

    useEffect(() => {
        setCurationSummary((prev) => {
            const numTotalStudies = (columns || []).reduce(
                (acc, curr) => acc + curr.stubStudies.length,
                0
            );

            // all included studies are in the last column
            const includedStudiesCol = columns[columns.length - 1];
            const numIncludedStudes = !includedStudiesCol
                ? 0
                : includedStudiesCol.stubStudies.length;
            const numExcludedStudies = columns.reduce(
                (acc, curr) =>
                    acc + curr.stubStudies.filter((study) => !!study.exclusionTag).length,
                0
            );
            const numUncategorizedStudies =
                numTotalStudies - numIncludedStudes - numExcludedStudies;

            return {
                total: numTotalStudies,
                included: numIncludedStudes,
                uncategorized: numUncategorizedStudies,
                excluded: numExcludedStudies,
            };
        });
    }, [columns]);

    return { ...curationSummary };
};

export default useGetCurationSummary;

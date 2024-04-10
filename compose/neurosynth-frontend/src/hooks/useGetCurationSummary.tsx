import { ICurationColumn } from 'components/CurationComponents/CurationColumn/CurationColumn';
import { useProjectCurationColumns } from 'pages/Projects/ProjectPage/ProjectStore';
import { useEffect, useState } from 'react';

export interface ICurationSummary {
    total: number;
    included: number;
    uncategorized: number;
    excluded: number;
}

export const getCurationSummary = (curationColumns: ICurationColumn[]) => {
    const numTotalStudies = (curationColumns || []).reduce(
        (acc, curr) => acc + curr.stubStudies.length,
        0
    );

    // all included studies are in the last column
    const includedStudiesCol = curationColumns[curationColumns.length - 1];
    const numIncludedStudes = !includedStudiesCol ? 0 : includedStudiesCol.stubStudies.length;
    const numExcludedStudies = curationColumns.reduce(
        (acc, curr) => acc + curr.stubStudies.filter((study) => !!study.exclusionTag).length,
        0
    );
    const numUncategorizedStudies = numTotalStudies - numIncludedStudes - numExcludedStudies;

    return {
        total: numTotalStudies,
        included: numIncludedStudes,
        uncategorized: numUncategorizedStudies,
        excluded: numExcludedStudies,
    };
};

const useGetCurationSummary = () => {
    const columns = useProjectCurationColumns();

    const [curationSummary, setCurationSummary] = useState<ICurationSummary>({
        total: 0,
        included: 0,
        uncategorized: 0,
        excluded: 0,
    });

    useEffect(() => {
        setCurationSummary(() => getCurationSummary(columns || []));
    }, [columns]);

    return { ...curationSummary };
};

export default useGetCurationSummary;

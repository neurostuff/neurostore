import { useEffect, useState } from 'react';
import useGetProjectById from './requests/useGetProjectById';

export interface ICurationSummary {
    total: number;
    included: number;
    uncategorized: number;
    excluded: number;
}

const useGetCurationSummary = (projectId: string) => {
    const { data: project } = useGetProjectById(projectId);

    const [curationSummary, setCurationSummary] = useState<ICurationSummary>({
        total: 0,
        included: 0,
        uncategorized: 0,
        excluded: 0,
    });

    useEffect(() => {
        setCurationSummary((prev) => {
            if (
                !projectId ||
                !project?.provenance?.curationMetadata?.columns ||
                project.provenance.curationMetadata.columns.length <= 0
            ) {
                return prev;
            }

            const curationMetadata = project.provenance.curationMetadata;
            const numTotalStudies = curationMetadata.columns.reduce(
                (acc, curr) => acc + curr.stubStudies.length,
                0
            );

            // all included studies are in the last column
            const numIncludedStudes =
                curationMetadata.columns[curationMetadata.columns.length - 1].stubStudies.length;
            const numExcludedStudies = curationMetadata.columns.reduce(
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
    }, [project, projectId, setCurationSummary]);

    return { ...curationSummary };
};

export default useGetCurationSummary;

import { useEffect, useState } from 'react';
import useGetProjectById from './requests/useGetProjectById';
import useGetStudysetById from './requests/useGetStudysetById';

export interface IExtractionSummary {
    savedForLater: number;
    uncategorized: number;
    completed: number;
    total: number;
}

const useGetExtractionSummary = (projectId: string) => {
    const { data: project } = useGetProjectById(projectId);
    const { data: studyset } = useGetStudysetById(
        project?.provenance?.extractionMetadata?.studysetId || undefined
    );
    const [extractionSummary, setExtractionSummary] = useState<IExtractionSummary>({
        savedForLater: 0,
        uncategorized: 0,
        completed: 0,
        total: 0,
    });

    useEffect(() => {
        setExtractionSummary((prev) => {
            if (
                !projectId ||
                !project?.provenance?.extractionMetadata?.studysetId ||
                !project.provenance.extractionMetadata?.studyStatusList
            ) {
                return prev;
            }

            const extractionMetadata = project.provenance.extractionMetadata;

            const total = (studyset?.studies || []).length;

            // all included studies are in the last column
            const numCompletedStudies = extractionMetadata.studyStatusList.filter(
                (study) => study.status === 'COMPLETE'
            ).length;

            const numSavedForLaterStudies = extractionMetadata.studyStatusList.filter(
                (study) => study.status === 'SAVEFORLATER'
            ).length;

            const numUncategorizedStudies = total - numCompletedStudies - numSavedForLaterStudies;

            return {
                total: total,
                completed: numCompletedStudies,
                savedForLater: numSavedForLaterStudies,
                uncategorized: numUncategorizedStudies,
            };
        });
    }, [project, projectId, setExtractionSummary, studyset]);

    return { ...extractionSummary };
};

export default useGetExtractionSummary;

import {
    useProjectExtractionStudysetId,
    useProjectExtractionStudyStatusList,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { useEffect, useState } from 'react';
import useGetStudysetById from './studysets/useGetStudysetById';

export interface IExtractionSummary {
    savedForLater: number;
    uncategorized: number;
    completed: number;
    total: number;
}

const useGetExtractionSummary = (projectId: string) => {
    const studysetId = useProjectExtractionStudysetId();
    const studyStatusList = useProjectExtractionStudyStatusList();
    const { data: studyset } = useGetStudysetById(studysetId, false);
    const [extractionSummary, setExtractionSummary] = useState<IExtractionSummary>({
        savedForLater: 0,
        uncategorized: 0,
        completed: 0,
        total: 0,
    });

    useEffect(() => {
        setExtractionSummary((prev) => {
            if (!projectId || !studysetId || !studyStatusList) {
                return {
                    savedForLater: 0,
                    uncategorized: 0,
                    completed: 0,
                    total: 0,
                };
            }

            const total = (studyset?.studies || []).length;

            // all included studies are in the last column
            const numCompletedStudies = studyStatusList.filter(
                (study) => study.status === 'COMPLETE'
            ).length;

            const numSavedForLaterStudies = studyStatusList.filter(
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
    }, [projectId, studyStatusList, studyset, studysetId]);

    return { ...extractionSummary };
};

export default useGetExtractionSummary;

import {
    useProjectExtractionStudysetId,
    useProjectExtractionStudyStatusList,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { useEffect, useState } from 'react';
import useGetStudysetById from './studysets/useGetStudysetById';
import { EExtractionStatus } from 'pages/ExtractionPage/ExtractionPage';

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

            const studysetStudies = studyset?.studies || [];

            const summary = {
                total: studysetStudies.length,
                completed: 0,
                savedForLater: 0,
                uncategorized: 0,
            };

            studysetStudies.forEach((studyId) => {
                // this studyStatusList is initially empty. Studies get added to it when they are moved to complete or saveforlater, i.e.
                // when they are categporized. We treat any study not yet in this list as uncategorized.
                const foundStatus = studyStatusList.find((status) => status.id === studyId);

                switch (foundStatus?.status) {
                    case EExtractionStatus.COMPLETED:
                        summary.completed++;
                        break;
                    case EExtractionStatus.SAVEDFORLATER:
                        summary.savedForLater++;
                        break;
                    default:
                        summary.uncategorized++;
                        break;
                }
            });

            return summary;
        });
    }, [projectId, studyStatusList, studyset, studysetId]);

    return { ...extractionSummary };
};

export default useGetExtractionSummary;

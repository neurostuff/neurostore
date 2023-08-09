import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import useStudyStore from 'stores/StudyStore/store';
import { useStudyId } from 'stores/StudyStore/getters';

// study action hooks
export const useInitStudyStore = () => useStudyStore((state) => state.initStudyStore);
export const useClearStudyStore = () => useStudyStore((state) => state.clearStudyStore);
export const useUpdateStudyDetails = () => useStudyStore((state) => state.updateStudy);
export const useUpdateStudyInDB = () => useStudyStore((state) => state.updateStudyInDB);
export const useAddOrUpdateMetadata = () =>
    useStudyStore((state) => state.addOrUpdateStudyMetadataRow);
export const useDeleteMetadataRow = () => useStudyStore((state) => state.deleteStudyMetadataRow);
export const useAddOrUpdateAnalysis = () => useStudyStore((state) => state.addOrUpdateAnalysis);
export const useCreateCondition = () => useStudyStore((state) => state.createCondition);
export const useAddOrUpdateConditionWeightPairForAnalysis = () =>
    useStudyStore((state) => state.addOrUpdateConditionWeightPairForAnalysis);
export const useDeleteConditionFromAnalysis = () =>
    useStudyStore((state) => state.deleteConditionFromAnalysis);
export const useUpdateAnalysisPoints = () => useStudyStore((state) => state.updateAnalysisPoints);
export const useCreateAnalysisPoints = () => useStudyStore((state) => state.createAnalysisPoints);
export const useDeleteAnalysisPoints = () => useStudyStore((state) => state.deleteAnalysisPoints);
export const useSetIsValid = () => useStudyStore((state) => state.setIsValid);
export const useDeleteAnalysis = () => useStudyStore((state) => state.deleteAnalysis);
export const useInitStudyStoreIfRequired = () => {
    const clearStudyStore = useClearStudyStore();
    const initStudyStore = useInitStudyStore();

    const { studyId } = useParams<{ projectId: string; studyId: string }>();
    const studyIdFromProject = useStudyId();

    useEffect(() => {
        if (studyId !== studyIdFromProject) {
            clearStudyStore();
            initStudyStore(studyId);
        }
    }, [clearStudyStore, initStudyStore, studyId, studyIdFromProject]);
};

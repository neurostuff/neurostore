import useStudyStore from 'stores/StudyStore/store';

// study retrieval hooks
export const useStudyId = () => useStudyStore((state) => state.study.id);
export const useStudyIsLoading = () => useStudyStore((state) => state.storeMetadata.studyIsLoading);
export const useConditionsIsLoading = () =>
    useStudyStore((state) => state.storeMetadata.conditionsIsLoading);
export const useStudyHasBeenEdited = () =>
    useStudyStore((state) => state.storeMetadata.studyIsEdited);
export const useConditionsIsEdited = () =>
    useStudyStore((state) => state.storeMetadata.conditionsIsEdited);

export const useStudyName = () => useStudyStore((state) => state.study.name);
export const useStudyDescription = () => useStudyStore((state) => state.study.description);
export const useStudyAuthors = () => useStudyStore((state) => state.study.authors);
export const useStudyPMID = () => useStudyStore((state) => state.study.pmid);
export const useStudyDOI = () => useStudyStore((state) => state.study.doi);
export const useStudyPublication = () => useStudyStore((state) => state.study.publication);
export const useStudyYear = () => useStudyStore((state) => state.study.year);

export const useStudyMetadata = () => useStudyStore((state) => state.study.metadata);
export const useConditions = () => useStudyStore((state) => state.conditions);

export const useStudyAnalysis = (analysisId?: string) =>
    useStudyStore((state) => {
        if (!analysisId) return undefined;

        const foundAnalysis = state.study.analyses.find((x) => x.id === analysisId);
        if (!foundAnalysis) return undefined;
        return foundAnalysis;
    });
export const useStudyAnalysisName = (analysisId?: string) =>
    useStudyStore((state) => {
        if (!analysisId) return '';

        const foundAnalysis = state.study.analyses.find((x) => x.id === analysisId);
        if (!foundAnalysis) return '';
        return foundAnalysis.name;
    });
export const useStudyAnalysisDescription = (analysisId?: string) =>
    useStudyStore((state) => {
        if (!analysisId) return '';

        const foundAnalysis = state.study.analyses.find((x) => x.id === analysisId);
        if (!foundAnalysis) return '';
        return foundAnalysis.description;
    });
export const useStudyAnalysisConditions = (analysisId?: string) =>
    useStudyStore((state) => {
        if (!analysisId) return [];

        const foundAnalysis = state.study.analyses.find((x) => x.id === analysisId);
        if (!foundAnalysis) return [];
        return foundAnalysis.conditions;
    });
export const useStudyAnalysisWeights = (analysisId?: string) =>
    useStudyStore((state) => {
        if (!analysisId) return [];

        const foundAnalysis = state.study.analyses.find((x) => x.id === analysisId);
        if (!foundAnalysis) return [];
        return foundAnalysis.weights;
    });
export const useStudyAnalysisPoints = (analysisId?: string) =>
    useStudyStore((state) => {
        if (!analysisId) return [];

        const foundAnalysis = state.study.analyses.find((x) => x.id === analysisId);
        if (!foundAnalysis) return null;
        return foundAnalysis.points || null;
    });
export const useStudyAnalysisPointSpace = (analysisId?: string) =>
    useStudyStore((state) => {
        if (!analysisId) return null;

        const foundAnalysis = state.study.analyses.find((x) => x.id === analysisId);
        if (!foundAnalysis) return null;
        return foundAnalysis.pointSpace;
    });
export const useStudyAnalysisPointStatistic = (analysisId?: string) =>
    useStudyStore((state) => {
        if (!analysisId) return null;

        const foundAnalysis = state.study.analyses.find((x) => x.id === analysisId);
        if (!foundAnalysis) return null;
        return foundAnalysis.pointStatistic;
    });
export const useNumStudyAnalyses = () => useStudyStore((state) => state.study.analyses.length);
export const useStudyAnalyses = () => useStudyStore((state) => state.study.analyses);
export const useIsValid = () => useStudyStore((state) => state.storeMetadata.isValid);
export const useIsError = () => useStudyStore((state) => state.storeMetadata.isError);
export const useStudyUser = () => useStudyStore((state) => state.study.user);

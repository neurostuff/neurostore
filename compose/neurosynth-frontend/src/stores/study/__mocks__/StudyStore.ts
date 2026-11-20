import { vi } from 'vitest';
import { mockAnalyses, mockStudy } from 'testing/mockData';

const useStudyId = vi.fn().mockReturnValue('study-id');

const useStudyName = vi.fn().mockResolvedValue('test-study-name');

const useProjectId = vi.fn().mockReturnValue('project-id');

const useStudyBaseStudyId = vi.fn().mockReturnValue('base-study-id');

const useUpdateStudyDetails = vi.fn().mockReturnValue(vi.fn());

const useStudy = vi.fn().mockReturnValue(mockStudy());

const useStudyUser = vi.fn().mockReturnValue('some-github-user');

const useUpdateStudyIsLoading = vi.fn().mockReturnValue(false);

const useStudyHasBeenEdited = vi.fn().mockReturnValue(false);

const useStudyAnalyses = vi.fn().mockReturnValue(mockAnalyses());

const useStudyAnalysisPoints = vi.fn().mockReturnValue([]);

const useUpdateStudyInDB = vi.fn().mockReturnValue(vi.fn());

const useGetStudyIsLoading = vi.fn().mockReturnValue(false);

const useStudyStore = Object.assign(vi.fn(), {
    getState: vi.fn(() => ({
        study: {
            ...useStudy(),
            analyses: useStudyAnalyses(),
        },
    })),
});

const useStudyAnalysisPointStatistic = vi.fn().mockReturnValue(null);

const useMarkStudyEdited = vi.fn().mockReturnValue(vi.fn());

const useReplaceAnalysisPoints = vi.fn().mockReturnValue(vi.fn());

const useStudyAnalysisWarnings = vi.fn().mockReturnValue({
    hasDuplicateName: false,
    hasNoName: false,
    hasEmptyPoints: false,
    hasNonMNICoordinates: false,
    hasInvalidEntries: false,
});

const useSetAnalysisPointWarnings = vi.fn().mockReturnValue(vi.fn());

export {
    useStudyId,
    useStudyName,
    useProjectId,
    useStudyBaseStudyId,
    useUpdateStudyDetails,
    useStudy,
    useStudyUser,
    useUpdateStudyIsLoading,
    useStudyHasBeenEdited,
    useStudyAnalyses,
    useStudyAnalysisPoints,
    useUpdateStudyInDB,
    useGetStudyIsLoading,
    useStudyStore,
    useStudyAnalysisPointStatistic,
    useMarkStudyEdited,
    useReplaceAnalysisPoints,
    useStudyAnalysisWarnings,
    useSetAnalysisPointWarnings,
};

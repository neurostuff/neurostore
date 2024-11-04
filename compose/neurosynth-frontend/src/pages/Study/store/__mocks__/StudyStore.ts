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

const useUpdateStudyInDB = vi.fn().mockReturnValue(vi.fn());

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
    useUpdateStudyInDB,
};

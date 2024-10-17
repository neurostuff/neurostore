import { mockAnalyses, mockStudy } from 'testing/mockData';

const useStudyId = jest.fn().mockReturnValue('study-id');

const useStudyName = jest.fn().mockResolvedValue('test-study-name');

const useProjectId = jest.fn().mockReturnValue('project-id');

const useStudyBaseStudyId = jest.fn().mockReturnValue('base-study-id');

const useUpdateStudyDetails = jest.fn().mockReturnValue(jest.fn());

const useStudy = jest.fn().mockReturnValue(mockStudy());

const useStudyUser = jest.fn().mockReturnValue('some-github-user');

const useUpdateStudyIsLoading = jest.fn().mockReturnValue(false);

const useStudyHasBeenEdited = jest.fn().mockReturnValue(false);

const useStudyAnalyses = jest.fn().mockReturnValue(mockAnalyses());

const useUpdateStudyInDB = jest.fn().mockReturnValue(jest.fn());

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

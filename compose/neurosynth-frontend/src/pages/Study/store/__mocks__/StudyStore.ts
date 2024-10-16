const useStudyId = jest.fn().mockReturnValue('study-id');

const useStudyName = jest.fn().mockResolvedValue('test-study-name');

const useProjectId = jest.fn().mockReturnValue('project-id');

const useStudyBaseStudyId = jest.fn().mockReturnValue('base-study-id');

const useUpdateStudyDetails = jest.fn();

export { useStudyId, useStudyName, useProjectId, useStudyBaseStudyId, useUpdateStudyDetails };

const useStudyId = jest.fn().mockReturnValue('study-id');

const useStudyName = jest.fn().mockResolvedValue('test-study-name');

const useProjectId = jest.fn().mockReturnValue('project-id');

export { useStudyId, useStudyName, useProjectId };

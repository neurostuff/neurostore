const useStudyId = jest.fn().mockReturnValue('study-id');

const useStudyName = jest.fn().mockResolvedValue('test-study-name');

export { useStudyId, useStudyName };

const useProjectExtractionAnnotationId = jest.fn().mockReturnValue('annotation-id');

const useProjectExtractionStudysetId = jest.fn().mockReturnValue('studyset-id');

const useProjectId = jest.fn().mockReturnValue('project-id');

const useProjectExtractionStudyStatus = jest.fn();

const useProjectExtractionStudyStatusList = jest.fn();

const useProjectMetaAnalysisCanEdit = jest.fn().mockReturnValue(true);

const useProjectExtractionAddOrUpdateStudyListStatus = jest.fn().mockReturnValue(jest.fn());

const useProjectUser = jest.fn().mockReturnValue('user-id');

const useProjectName = jest.fn().mockReturnValue('project-name');

const useProjectCurationColumns = jest.fn();

export {
    useProjectExtractionAnnotationId,
    useProjectExtractionStudysetId,
    useProjectId,
    useProjectExtractionStudyStatus,
    useProjectExtractionStudyStatusList,
    useProjectMetaAnalysisCanEdit,
    useProjectExtractionAddOrUpdateStudyListStatus,
    useProjectUser,
    useProjectName,
    useProjectCurationColumns,
};

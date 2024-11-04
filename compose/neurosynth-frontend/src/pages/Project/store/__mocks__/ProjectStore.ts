import { vi } from 'vitest';

const useProjectExtractionAnnotationId = vi.fn().mockReturnValue('annotation-id');

const useProjectExtractionStudysetId = vi.fn().mockReturnValue('studyset-id');

const useProjectId = vi.fn().mockReturnValue('project-id');

const useProjectExtractionStudyStatus = vi.fn();

const useProjectExtractionStudyStatusList = vi.fn();

const useProjectMetaAnalysisCanEdit = vi.fn().mockReturnValue(true);

const useProjectExtractionAddOrUpdateStudyListStatus = vi.fn().mockReturnValue(vi.fn());

const useProjectUser = vi.fn().mockReturnValue('user-id');

const useProjectName = vi.fn().mockReturnValue('project-name');

const useProjectCurationColumns = vi.fn();

const useProjectExtractionReplaceStudyListStatusId = vi.fn().mockReturnValue(vi.fn());

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
    useProjectExtractionReplaceStudyListStatusId,
};

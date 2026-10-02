import { EAnalysisType } from 'hooks/projects/Project.types';
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

const useProjectDescription = vi.fn().mockReturnValue('project-description');

const useProjectNumCurationColumns = vi.fn().mockReturnValue(1);

const useUpdateExtractionMetadata = vi.fn().mockReturnValue(vi.fn());

const useProjectCurationColumns = vi.fn();

const useProjectCurationColumn = vi.fn().mockReturnValue({ stubStudies: [] });

const useProjectCurationIsPrisma = vi.fn().mockReturnValue(false);

const useProjectCurationDuplicates = vi.fn().mockReturnValue([]);

const useProjectCurationImports = vi.fn().mockReturnValue([]);

const useProjectExtractionReplaceStudyListStatusId = vi.fn().mockReturnValue(vi.fn());

const useProjectExclusionTags = vi.fn().mockReturnValue(vi.fn());

const useProjectAnalysisType = vi.fn().mockReturnValue(EAnalysisType.CBMA);

const useAddTagToStub = vi.fn().mockReturnValue(vi.fn());

const useCreateNewExclusion = vi.fn().mockReturnValue(vi.fn());

const useDemoteStub = vi.fn().mockReturnValue(vi.fn());

const usePromoteStub = vi.fn().mockReturnValue(vi.fn());

const useSetExclusionForStub = vi.fn().mockReturnValue(vi.fn());

const useProjectExclusionTag = vi.fn().mockReturnValue(undefined);

const useProjectCurationPrismaConfig = vi.fn().mockReturnValue({ isPrisma: false });

const useUpdateStubField = vi.fn().mockReturnValue(vi.fn());

const useUpdateExclusionTag = vi.fn().mockReturnValue(vi.fn());

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
    useProjectDescription,
    useProjectNumCurationColumns,
    useUpdateExtractionMetadata,
    useProjectCurationColumns,
    useProjectCurationColumn,
    useProjectCurationIsPrisma,
    useProjectCurationDuplicates,
    useProjectCurationImports,
    useProjectExtractionReplaceStudyListStatusId,
    useProjectExclusionTags,
    useProjectAnalysisType,
    useAddTagToStub,
    useCreateNewExclusion,
    useDemoteStub,
    usePromoteStub,
    useSetExclusionForStub,
    useProjectExclusionTag,
    useProjectCurationPrismaConfig,
    useUpdateStubField,
    useUpdateExclusionTag,
};

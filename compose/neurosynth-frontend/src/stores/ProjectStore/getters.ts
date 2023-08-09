import { ICurationStubStudy } from 'interfaces/project/curation.interface';
import { useEffect, useState } from 'react';
import useProjectStore from 'stores/ProjectStore/store';

// higher level project retrieval hooks
export const useProjectName = () => useProjectStore((state) => state.name);
export const useProjectDescription = () => useProjectStore((state) => state.description);
export const useProjectProvenance = () => useProjectStore((state) => state.provenance);
export const useGetProjectIsLoading = () =>
    useProjectStore((state) => state.metadata.getProjectIsLoading);
export const useProjectIsError = () => useProjectStore((state) => state.metadata.isError);
export const useProjectUser = () => useProjectStore((state) => state.user);
export const useUpdateProjectIsLoading = () =>
    useProjectStore((state) => state.metadata.updateProjectIsLoading);

// curation retrieval hooks
export const useProjectCurationColumns = () =>
    useProjectStore((state) => state.provenance.curationMetadata.columns);
export const useProjectCurationAllStubs = () => {
    const columns = useProjectCurationColumns();
    const [allStubs, setAllStubs] = useState<ICurationStubStudy[]>([]);
    useEffect(() => {
        setAllStubs(() => {
            const stubs = columns.reduce((acc, curr) => {
                acc.push(...curr.stubStudies);
                return acc;
            }, [] as ICurationStubStudy[]);
            return stubs;
        });
    }, [columns]);

    return allStubs;
};

export const useProjectCurationIsLastColumn = (columnIndex: number) =>
    useProjectStore((state) => state.provenance.curationMetadata.columns.length <= columnIndex + 1);
export const useProjectNumCurationColumns = () =>
    useProjectStore((state) => state.provenance.curationMetadata.columns.length);
export const useProjectCurationColumn = (columnIndex: number) =>
    useProjectStore((state) => state.provenance.curationMetadata.columns[columnIndex]);
export const useProjectExtractionMetadata = () =>
    useProjectStore((state) => state.provenance.extractionMetadata);
export const useProjectId = () => useProjectStore((state) => state.id);
export const useProjectCurationIsPrisma = () =>
    useProjectStore((state) => state.provenance.curationMetadata.prismaConfig.isPrisma);
export const useProjectCurationPrismaConfig = () =>
    useProjectStore((state) => state.provenance.curationMetadata.prismaConfig);
export const useProjectCurationImports = () =>
    useProjectStore((state) => state.provenance.curationMetadata.imports);
export const useProjectCurationExclusionTags = () =>
    useProjectStore((state) => state.provenance.curationMetadata.exclusionTags);

// extraction retrieval hooks
export const useProjectExtractionStudysetId = () =>
    useProjectStore((state) => state.provenance.extractionMetadata.studysetId);
export const useProjectExtractionAnnotationId = () =>
    useProjectStore((state) => state.provenance.extractionMetadata.annotationId);
export const useProjectExtractionStudyStatusList = () =>
    useProjectStore((state) => state.provenance.extractionMetadata.studyStatusList);
export const useProjectExtractionStudyStatus = (studyId: string) =>
    useProjectStore((state) =>
        state.provenance.extractionMetadata.studyStatusList.find((x) => x.id === studyId)
    );
export const useProjectExtractionAddOrUpdateStudyListStatus = () =>
    useProjectStore((state) => state.addOrUpdateStudyListStatus);
export const useProjectExtractionReplaceStudyListStatusId = () =>
    useProjectStore((state) => state.replaceStudyListStatusId);
export const useProjectExtractionSetGivenStudyStatusesAsComplete = () =>
    useProjectStore((state) => state.setGivenStudyStatusesAsComplete);

// metaAnalysisAlgorithm retrieval hooks
export const useProjectMetaAnalysisCanEdit = () =>
    useProjectStore((state) => state?.provenance?.metaAnalysisMetadata?.canEditMetaAnalyses);

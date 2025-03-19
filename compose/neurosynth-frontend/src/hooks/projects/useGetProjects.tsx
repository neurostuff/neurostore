import { Project, ProjectReturn } from 'neurosynth-compose-typescript-sdk';
import { ICurationColumn } from 'pages/Curation/Curation.types';
import { EImportMode } from 'pages/CurationImport/CurationImport.types';
import { EExtractionStatus } from 'pages/Extraction/ExtractionPage';
import { SortBy } from 'pages/Study/Study.types';
import { useQuery } from 'react-query';
import API from 'utils/api';

export interface ITag {
    label: string;
    id: string;
    isExclusionTag: boolean;
    isAssignable: boolean; // whether or not this tag can be attached to a study
}

export interface ISource {
    label: string;
    id: string;
}

export interface IPRISMAConfig {
    isPrisma: boolean;
    identification: {
        exclusionTags: ITag[];
    };
    screening: {
        exclusionTags: ITag[];
    };
    eligibility: {
        exclusionTags: ITag[];
    };
}

export interface IImport {
    id: string;
    name: string;
    date: string; // ISO DateTime
    importModeUsed: EImportMode;
    errorsDuringImport?: string;
    numImported: number;
    neurostoreSearchParams?: string; // search params used for studies (if neurostore was used for import)
}

export interface ICurationMetadata {
    columns: ICurationColumn[];
    prismaConfig: IPRISMAConfig;
    infoTags: ITag[];
    exclusionTags: ITag[]; // for non prisma workflows, we ignore prismaConfig and use exclusionTags. This property will not be used for the prisma workflow.
    identificationSources: ISource[];
    imports: IImport[];
}

export interface IStudyExtractionStatus {
    status: EExtractionStatus;
    id: string;
}

export interface IExtractionMetadata {
    studyStatusList: IStudyExtractionStatus[];
    annotationId: string | undefined;
    studysetId: string | undefined;
}

export interface IMetaAnalysisMetadata {
    canEditMetaAnalyses: boolean;
}

export interface IProvenance {
    curationMetadata: ICurationMetadata;
    extractionMetadata: IExtractionMetadata;
    metaAnalysisMetadata: IMetaAnalysisMetadata;
}

// define this interface to overwrite provenance type
export interface INeurosynthProject extends Omit<Project, 'provenance'> {
    provenance: IProvenance;
}

// define this interface to overwrite provenance type
export interface INeurosynthProjectReturn extends Omit<ProjectReturn, 'provenance'> {
    provenance: IProvenance;
}

export const indexToPRISMAMapping = (index: number): keyof Omit<IPRISMAConfig, 'isPrisma'> | undefined => {
    switch (index) {
        case 0:
            return 'identification';
        case 1:
            return 'screening';
        case 2:
            return 'eligibility';
        default:
            return undefined;
    }
};

export class ProjectSearchCriteria {
    constructor(
        public pageOfResults: number = 1,
        public pageSize: number = 10,
        public nameSearch: string | undefined = undefined,
        public genericSearchStr: string | undefined = undefined,
        public descriptionSearch: string | undefined = undefined,
        public sortBy: SortBy | undefined = undefined,
        public descOrder: boolean = true
    ) {}
}

export const projectsSearchHelper = (projectSearchCriteria: Partial<ProjectSearchCriteria>, userId?: string) => {
    return API.NeurosynthServices.ProjectsService.projectsGet(
        projectSearchCriteria.pageOfResults || undefined,
        projectSearchCriteria.pageSize,
        projectSearchCriteria.nameSearch,
        projectSearchCriteria.genericSearchStr,
        projectSearchCriteria.descriptionSearch,
        projectSearchCriteria.sortBy === SortBy.LASTUPDATED ? undefined : projectSearchCriteria.sortBy,
        projectSearchCriteria.descOrder,
        userId
    );
};

const useGetProjects = (projectSearchCriteria: ProjectSearchCriteria) => {
    return useQuery(['projects', { ...projectSearchCriteria }], () => projectsSearchHelper(projectSearchCriteria), {
        select: (axiosResponse) => (axiosResponse.data.results as INeurosynthProjectReturn[]) || [],
        refetchOnWindowFocus: false,
    });
};

export default useGetProjects;

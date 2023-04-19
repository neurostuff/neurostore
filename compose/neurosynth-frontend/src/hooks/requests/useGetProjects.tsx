import { ICurationColumn } from 'components/CurationComponents/CurationColumn/CurationColumn';
import { EPropertyType } from 'components/EditMetadata';
import { Project, ProjectReturn } from 'neurosynth-compose-typescript-sdk';
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

export interface IAlgorithmMetadata {
    specificationId: string | undefined;
}

export interface ISelectionMetadata {
    filter: {
        selectionKey: string | undefined;
        type: EPropertyType;
    };
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

export interface ICurationMetadata {
    columns: ICurationColumn[];
    prismaConfig: IPRISMAConfig;
    infoTags: ITag[];
    exclusionTags: ITag[]; // for non prisma workflows, we ignore prismaConfig and use exclusionTags. This property will not be used for the prisma workflow.
    identificationSources: ISource[];
}

export interface IStudyExtractionStatus {
    status: 'COMPLETE' | 'SAVEFORLATER';
    id: string;
}

export interface IExtractionMetadata {
    studyStatusList: IStudyExtractionStatus[];
    annotationId: string | undefined;
    studysetId: string | undefined;
}

export interface IProvenance {
    curationMetadata: ICurationMetadata;
    extractionMetadata: IExtractionMetadata;
    selectionMetadata: ISelectionMetadata;
    algorithmMetadata: IAlgorithmMetadata;
}

// define this interface to overwrite provenance type
export interface INeurosynthProject extends Omit<Project, 'provenance'> {
    provenance: IProvenance;
}

// define this interface to overwrite provenance type
export interface INeurosynthProjectReturn extends Omit<ProjectReturn, 'provenance'> {
    provenance: IProvenance;
}

export const indexToPRISMAMapping = (
    index: number
): keyof Omit<IPRISMAConfig, 'isPrisma'> | undefined => {
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

const useGetProjects = (authenticatedUser?: string) => {
    return useQuery(
        ['projects', authenticatedUser],
        () => API.NeurosynthServices.ProjectsService.projectsGet(),
        {
            select: (axiosResponse) =>
                ((axiosResponse.data.results as INeurosynthProjectReturn[]) || []).filter(
                    (x) => x.user === authenticatedUser
                ),
            enabled: !!authenticatedUser,
        }
    );
};

export default useGetProjects;

import { ICurationColumn } from 'components/CurationComponents/CurationColumn/CurationColumn';
import { EPropertyType } from 'components/EditMetadata';
import { Project, ProjectReturn } from 'neurosynth-compose-typescript-sdk';
import { useQuery } from 'react-query';
import API from 'utils/api';

export interface ITag {
    label: string;
    id: string;
    isExclusionTag: boolean;
}

export interface IAlgorithmMetadata {
    specificationId: string;
}

export interface IFiltrationMetadata {
    filter: {
        filtrationKey: string;
        type: EPropertyType;
    };
}

export interface ICurationMetadata {
    columns: ICurationColumn[];
    tags: ITag[];
}

interface IStudyExtractionStatus {
    status: 'COMPLETE' | 'SAVEFORLATER';
    id: string;
}

export interface IExtractionMetadata {
    studyStatusList: IStudyExtractionStatus[];
    annotationId?: string;
    studysetId: string;
}

export interface IProvenance {
    curationMetadata?: ICurationMetadata;
    extractionMetadata?: IExtractionMetadata;
    filtrationMetadata?: IFiltrationMetadata;
    algorithmMetadata?: IAlgorithmMetadata;
}

// define this interface to overwrite provenance type
export interface INeurosynthProject extends Omit<Project, 'provenance'> {
    provenance?: IProvenance;
}

// define this interface to overwrite provenance type
export interface INeurosynthProjectReturn extends Omit<ProjectReturn, 'provenance'> {
    provenance: IProvenance;
}

const useGetProjects = () => {
    return useQuery('projects', () => API.NeurosynthServices.ProjectsService.projectsGet(), {
        select: (axiosResponse) => axiosResponse.data.results as INeurosynthProjectReturn[],
    });
};

export default useGetProjects;

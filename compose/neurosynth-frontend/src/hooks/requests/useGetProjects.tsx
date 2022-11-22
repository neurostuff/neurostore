import { ICurationColumn } from 'components/CurationComponents/CurationColumn/CurationColumn';
import { useQuery } from 'react-query';

export interface ITag {
    label: string;
    id: string;
    isExclusionTag: boolean;
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
}

export interface IProject {
    id: string;
    name: string;
    description: string;
    provenance: null | {
        curationMetadata?: ICurationMetadata;
        extractionMetadata?: IExtractionMetadata;
    };
    studysetId: string | null;
    metaAnalysisId: string | null;
}

const useGetProjects = () => {
    return useQuery(['projects'], () => {
        // API.NeurostoreServices.ProjectsService.ProjectsGet
        const mockProjects: IProject[] = [
            {
                id: '129hf8iuse',
                name: 'my project name',
                description: 'my project description',
                provenance: {},
                studysetId: null,
                metaAnalysisId: null,
            },
            {
                id: 'nioh0993n42b',
                name: 'some other test project',
                description:
                    'this is a description to talk about a new project that i am making for demo purposes',
                provenance: {},
                studysetId: null,
                metaAnalysisId: null,
            },
        ];

        const x = new Promise<IProject[]>((res, rej) => {
            res(mockProjects);
        });

        return x;
    });
};

export default useGetProjects;

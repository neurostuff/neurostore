import API from 'api/api.config';
import { IPRISMAConfig } from 'pages/Curation/Curation.types';
import { SortBy } from 'pages/Study/Study.types';
import { useQuery } from 'react-query';
import { INeurosynthProjectReturn } from './Project.types';

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
        public sortBy: SortBy | undefined = SortBy.LASTUPDATED,
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
        projectSearchCriteria.sortBy === SortBy.LASTUPDATED ? 'updated_at' : projectSearchCriteria.sortBy,
        projectSearchCriteria.descOrder,
        userId
    );
};

const useGetProjects = (projectSearchCriteria: ProjectSearchCriteria, userSub?: string) => {
    return useQuery(
        ['projects', { ...projectSearchCriteria }, userSub],
        () => projectsSearchHelper(projectSearchCriteria, userSub),
        {
            select: (axiosResponse) => (axiosResponse.data.results as INeurosynthProjectReturn[]) || [],
            refetchOnWindowFocus: false,
        }
    );
};

export default useGetProjects;

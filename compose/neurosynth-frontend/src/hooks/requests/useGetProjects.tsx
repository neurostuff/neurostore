import { IPRISMAConfig } from 'interfaces/project/curation.interface';
import { INeurosynthProjectReturn } from 'interfaces/project/project.interface';
import { useQuery } from 'react-query';
import API from 'utils/api';

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
                (axiosResponse.data.results as INeurosynthProjectReturn[]) || [],
            enabled: !!authenticatedUser,
        }
    );
};

export default useGetProjects;

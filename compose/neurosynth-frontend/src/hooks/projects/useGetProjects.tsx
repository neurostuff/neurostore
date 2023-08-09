import { INeurosynthProjectReturn } from 'interfaces/project/project.interface';
import { useQuery } from 'react-query';
import API from 'utils/api';

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

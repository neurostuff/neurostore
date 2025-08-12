import { useQuery } from 'react-query';
import API from 'utils/api';
import { INeurosynthProjectReturn } from './useGetProjects';

const useGetProjectById = (projectId: string | undefined) => {
    return useQuery(
        ['projects', projectId],
        () => API.NeurosynthServices.ProjectsService.projectsIdGet(projectId || ''),
        {
            select: (axiosResponse) => axiosResponse.data as INeurosynthProjectReturn,
            enabled: !!projectId,
            cacheTime: 0, // IMPORTANT: disable cache for this query as caching causes the project store to sometimes have old data when you switch between projects
        }
    );
};

export default useGetProjectById;

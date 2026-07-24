import { useQuery } from '@tanstack/react-query';
import API from 'api/api.config';
import { INeurosynthProjectReturn } from './useGetProjects';

const useGetProjectById = (projectId: string | undefined) => {
    return useQuery({
        queryKey: ['projects', projectId],
        queryFn: () => API.NeurosynthServices.ProjectsService.projectsIdGet(projectId || ''),
        select: (axiosResponse) => axiosResponse.data as INeurosynthProjectReturn,
        enabled: !!projectId,

        // IMPORTANT: disable cache for this query as caching causes the project store to sometimes have old data when you switch between projects
        gcTime: 0
    });
};

export default useGetProjectById;

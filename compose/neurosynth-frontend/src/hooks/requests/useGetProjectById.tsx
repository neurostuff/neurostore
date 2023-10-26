import { useQuery } from 'react-query';
import API from 'utils/api';
import { INeurosynthProjectReturn } from './useGetProjects';

const useGetProjectById = (projectId: string | undefined) => {
    return useQuery(
        ['projects', projectId],
        () =>
            API.NeurosynthServices.ProjectsService.projectsIdGet(projectId || '').then((res) => {
                return res;
            }),
        {
            select: (axiosResponse) => axiosResponse.data as INeurosynthProjectReturn,
            enabled: !!projectId,
        }
    );
};

export default useGetProjectById;

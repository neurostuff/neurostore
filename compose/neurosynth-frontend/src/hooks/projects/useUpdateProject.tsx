import { AxiosError, AxiosResponse } from 'axios';
import { ProjectReturn } from 'neurosynth-compose-typescript-sdk';
import { useMutation, useQueryClient } from 'react-query';
import API from 'api/api.config';
import { INeurosynthProject } from './useGetProjects';

const useUpdateProject = () => {
    const queryClient = useQueryClient();

    return useMutation<
        AxiosResponse<ProjectReturn>,
        AxiosError,
        { projectId: string; project: INeurosynthProject },
        unknown
    >((args) => API.NeurosynthServices.ProjectsService.projectsIdPut(args.projectId, true, args.project), {
        // For now, updating the project public status will also update the public status of all meta-analyses in the project
        onSuccess: (res) => {
            queryClient.setQueryData(['projects', res.data.id], res);
            queryClient.invalidateQueries('projects');
        },
    });
};

export default useUpdateProject;

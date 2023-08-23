import { AxiosError, AxiosResponse } from 'axios';
import { Project, ProjectReturn } from 'neurosynth-compose-typescript-sdk';
import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from 'react-query';
import API from 'utils/api';

const useCreateProject = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation<AxiosResponse<ProjectReturn>, AxiosError, Project, unknown>(
        (project) => API.NeurosynthServices.ProjectsService.projectsPost(project),
        {
            onSuccess: () => {
                // update queries
                queryClient.invalidateQueries('projects');
                enqueueSnackbar('Created new project successfully', { variant: 'success' });
            },
            onError: () => {
                enqueueSnackbar('There was an error creating the project', { variant: 'error' });
            },
            mutationKey: 'create-project',
        }
    );
};

export default useCreateProject;

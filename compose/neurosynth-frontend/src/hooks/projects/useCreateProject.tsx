import { AxiosError, AxiosResponse } from 'axios';
import { Project, ProjectReturn } from 'neurosynth-compose-typescript-sdk';
import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from 'react-query';
import API from 'api/api.config';

const useCreateProject = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation<AxiosResponse<ProjectReturn>, AxiosError, Project, unknown>(
        (project) =>
            // Signature: projectsPost(sourceId?, copyAnnotations?, project)
            // Explicitly pass `undefined` for the optional query params so the payload is treated as the body argument.
            API.NeurosynthServices.ProjectsService.projectsPost(
                undefined, // sourceId
                undefined, // copyAnnotations
                project
            ),
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

import { AxiosError, AxiosResponse } from 'axios';
import { ProjectReturn } from 'neurosynth-compose-typescript-sdk';
import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from 'react-query';
import API from 'utils/api';
import { INeurosynthProject } from './useGetProjects';

const useUpdateProject = () => {
    const { enqueueSnackbar } = useSnackbar();
    const queryClient = useQueryClient();
    return useMutation<
        AxiosResponse<ProjectReturn>,
        AxiosError,
        { projectId: string; project: INeurosynthProject },
        unknown
    >(
        (args) =>
            API.NeurosynthServices.ProjectsService.projectsIdPut(args.projectId, args.project),
        {
            onSuccess: () => {
                const x = queryClient.isMutating({
                    predicate: (m) => m.options.mutationKey === 'projects',
                });
                if (x <= 1) {
                    queryClient.invalidateQueries('projects');
                }
            },
            onError: () => {
                enqueueSnackbar('there was an error updating the project', { variant: 'error' });
            },
            mutationKey: 'projects',
        }
    );
};

export default useUpdateProject;

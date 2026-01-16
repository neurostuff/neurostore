import { AxiosError, AxiosResponse } from 'axios';
import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from 'react-query';
import API from 'api/api.config';

const useDeleteProject = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation<AxiosResponse, AxiosError, string, unknown>(
        (id) => API.NeurosynthServices.ProjectsService.projectsIdDelete(id),
        {
            onSuccess: (data, variables) => {
                queryClient.removeQueries({ queryKey: ['projects', variables] });
                return queryClient.invalidateQueries({ queryKey: ['projects'] });
            },
            onError: () => {
                enqueueSnackbar('There was an error deleting the project', { variant: 'error' });
            },
        }
    );
};

export default useDeleteProject;

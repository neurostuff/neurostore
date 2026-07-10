import API from 'api/api.config';
import { AxiosError, AxiosResponse } from 'axios';
import { useSnackbar } from 'notistack';
import { useMutation } from '@tanstack/react-query';

const useDeleteProject = () => {
    const { enqueueSnackbar } = useSnackbar();
    return useMutation<AxiosResponse, AxiosError, string, unknown>({
        mutationFn: (id) => API.NeurosynthServices.ProjectsService.projectsIdDelete(id),

        onError: () => {
            enqueueSnackbar('There was an error deleting the project', { variant: 'error' });
        }
    });
};

export default useDeleteProject;

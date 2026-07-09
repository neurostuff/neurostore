import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from 'react-query';
import API from 'api/api.config';

const useDeleteStudy = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation((id: string) => API.NeurostoreServices.StudiesService.studiesIdDelete(id), {
        onSuccess: () => {
            // we need to send a request to retrieve studies again with its associated analyses and points
            queryClient.invalidateQueries('studies');
            enqueueSnackbar('study deleted successfully', { variant: 'success' });
        },
        onError: () => {
            enqueueSnackbar('there was an error deleting the study', { variant: 'error' });
        },
    });
};

export default useDeleteStudy;

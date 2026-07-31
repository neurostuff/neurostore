import { useSnackbar } from 'notistack';
import { AxiosError, AxiosResponse } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import API from 'api/api.config';
import studysetQueries from 'hooks/studysets/studysetQueries';

const useDeleteStudyset = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation<AxiosResponse<void>, AxiosError, string, unknown>({
        mutationFn: (id: string) => API.NeurostoreServices.StudySetsService.studysetsIdDelete(id),

        onSuccess: () => {
            // we need to send a request to retrieve studies again with its associated analyses and points
            queryClient.invalidateQueries({ queryKey: studysetQueries.all() });
            enqueueSnackbar('studyset deleted successfully', { variant: 'success' });
        },

        onError: () => {
            enqueueSnackbar('there was an error deleting the studyset', { variant: 'error' });
        },
    });
};

export default useDeleteStudyset;

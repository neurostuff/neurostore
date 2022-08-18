import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from 'react-query';
import API from 'utils/api';

const useDeleteStudyset = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation(
        (id: string) => API.NeurostoreServices.StudySetsService.studysetsIdDelete(id),
        {
            onSuccess: () => {
                // we need to send a request to retrieve studies again with its associated analyses and points
                queryClient.invalidateQueries('studies');
                enqueueSnackbar('studyset deleted successfully', { variant: 'success' });
            },
            onError: () => {
                enqueueSnackbar('there was an error deleting the studyset', { variant: 'error' });
            },
        }
    );
};

export default useDeleteStudyset;

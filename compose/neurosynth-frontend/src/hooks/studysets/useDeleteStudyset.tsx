import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from 'react-query';
import API from 'api/api.config';
import studysetQueries from 'hooks/studysets/studysetQueries';

const useDeleteStudyset = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation({
        mutationFn: (id: string) => API.NeurostoreServices.StudySetsService.studysetsIdDelete(id),
        onSuccess: (_, studysetId) => {
            // we need to send a request to retrieve studies again with its associated analyses and points
            queryClient.invalidateQueries(studysetQueries.lists());
            queryClient.removeQueries(studysetQueries.details());
            enqueueSnackbar('studyset deleted successfully', { variant: 'success' });
        },
        onError: () => {
            enqueueSnackbar('there was an error deleting the studyset', { variant: 'error' });
        },
    });
};

export default useDeleteStudyset;

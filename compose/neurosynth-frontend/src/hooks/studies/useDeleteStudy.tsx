import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from 'react-query';
import API from 'api/api.config';
import studyQueries from 'hooks/studies/studyQueries';

const useDeleteStudy = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation({
        mutationFn: (id: string) => API.NeurostoreServices.StudiesService.studiesIdDelete(id),
        onSuccess: () => {
            // we need to send a request to retrieve studies again with its associated analyses and points
            queryClient.invalidateQueries(studyQueries.studies.all());
            queryClient.invalidateQueries(studyQueries.baseStudies.all());
            enqueueSnackbar('study deleted successfully', { variant: 'success' });
        },
        onError: () => {
            enqueueSnackbar('there was an error deleting the study', { variant: 'error' });
        },
    });
};

export default useDeleteStudy;

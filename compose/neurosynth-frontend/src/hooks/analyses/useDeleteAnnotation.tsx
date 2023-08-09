import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from 'react-query';
import API from 'utils/api';

const useDeleteAnnotation = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation(
        (id: string) => API.NeurostoreServices.AnnotationsService.annotationsIdDelete(id),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('studies');
                enqueueSnackbar('Annotation deleted successfully', { variant: 'success' });
            },
            onError: () => {
                enqueueSnackbar('there was an error deleting the annotation', { variant: 'error' });
            },
        }
    );
};

export default useDeleteAnnotation;

import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from 'react-query';
import API from 'api/api.config';
import annotationQueries from 'hooks/annotations/annotationQueries';

const useDeleteAnnotation = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation((id: string) => API.NeurostoreServices.AnnotationsService.annotationsIdDelete(id), {
        onSuccess: (_res, annotationId) => {
            queryClient.removeQueries(annotationQueries.byId(annotationId).queryKey);
            queryClient.invalidateQueries(annotationQueries.lists());
            enqueueSnackbar('Annotation deleted successfully', { variant: 'success' });
        },
        onError: () => {
            enqueueSnackbar('there was an error deleting the annotation', { variant: 'error' });
        },
    });
};

export default useDeleteAnnotation;

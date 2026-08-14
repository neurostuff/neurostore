import { useMutation, useQueryClient } from '@tanstack/react-query';
import API from 'api/api.config';
import annotationQueries from 'hooks/annotations/annotationQueries';
import { useSnackbar } from 'notistack';

const useDeleteAnnotation = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation({
        mutationFn: (id: string) => API.NeurostoreServices.AnnotationsService.annotationsIdDelete(id),
        onSuccess: (_res, annotationId) => {
            queryClient.removeQueries({ queryKey: annotationQueries.byId(annotationId).queryKey });
            queryClient.invalidateQueries({ queryKey: annotationQueries.lists() });
            enqueueSnackbar('Annotation deleted successfully', { variant: 'success' });
        },

        onError: () => {
            enqueueSnackbar('there was an error deleting the annotation', { variant: 'error' });
        },
    });
};

export default useDeleteAnnotation;

import { AxiosError, AxiosResponse } from 'axios';
import { useSnackbar } from 'notistack';
import { AnnotationReturn } from 'neurostore-typescript-sdk';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import API from 'api/api.config';

const useDeleteAnnotation = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation<AxiosResponse<void>, AxiosError, string, unknown>({
        mutationFn: (id: string) => API.NeurostoreServices.AnnotationsService.annotationsIdDelete(id),

        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['studies']
            });
            enqueueSnackbar('Annotation deleted successfully', { variant: 'success' });
        },

        onError: () => {
            enqueueSnackbar('there was an error deleting the annotation', { variant: 'error' });
        }
    });
};

export default useDeleteAnnotation;

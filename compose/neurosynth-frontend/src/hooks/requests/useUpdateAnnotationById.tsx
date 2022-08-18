import { AxiosError, AxiosResponse } from 'axios';
import { useMutation, useQueryClient } from 'react-query';
import { Annotation, AnnotationReturn } from 'neurostore-typescript-sdk';
import API from 'utils/api';
import { useSnackbar } from 'notistack';

const useUpdateAnnotationById = (annotationId: string | undefined | null) => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();

    return useMutation<
        AxiosResponse<AnnotationReturn>,
        AxiosError,
        {
            argAnnotationId: string;
            annotation: Annotation;
        },
        unknown
    >(
        (update) =>
            API.NeurostoreServices.AnnotationsService.annotationsIdPut(
                update.argAnnotationId,
                update.annotation
            ),
        {
            onSuccess: (res) => {
                queryClient.invalidateQueries(['annotation', annotationId]);
                enqueueSnackbar('annotation updated successfully', { variant: 'success' });
            },
            onError: () => {
                enqueueSnackbar('there was an error updating the annotation', { variant: 'error' });
            },
        }
    );
};

export default useUpdateAnnotationById;

import { AxiosError, AxiosResponse } from 'axios';
import { useMutation, useQueryClient } from 'react-query';
import API, { NeurostoreAnnotation } from 'api/api.config';
import { useSnackbar } from 'notistack';
import { AnnotationRequestOneOf } from 'neurostore-typescript-sdk';

const useUpdateAnnotationById = (
    annotationId: string | undefined | null,
    options?: { invalidateOnSuccess?: boolean }
) => {
    const invalidateOnSuccess = options?.invalidateOnSuccess ?? true;
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();

    return useMutation<
        AxiosResponse<NeurostoreAnnotation>,
        AxiosError,
        {
            argAnnotationId: string;
            annotation: AnnotationRequestOneOf;
        },
        unknown
    >(
        (update) =>
            API.NeurostoreServices.AnnotationsService.annotationsIdPut(update.argAnnotationId, update.annotation),
        {
            onSuccess: () => {
                if (invalidateOnSuccess) {
                    queryClient.invalidateQueries(['annotations', annotationId]);
                }
            },
            onError: () => {
                enqueueSnackbar('there was an error updating the annotation', { variant: 'error' });
            },
        }
    );
};

export default useUpdateAnnotationById;

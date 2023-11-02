import { AxiosError, AxiosResponse } from 'axios';
import { useMutation, useQueryClient } from 'react-query';
import API, { NeurostoreAnnotation } from 'utils/api';
import { useSnackbar } from 'notistack';

const useUpdateAnnotationById = (annotationId: string | undefined | null) => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();

    return useMutation<
        AxiosResponse<NeurostoreAnnotation>,
        AxiosError,
        {
            argAnnotationId: string;
            annotation: NeurostoreAnnotation;
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
                queryClient.invalidateQueries(['annotations', annotationId]);
            },
            onError: () => {
                enqueueSnackbar('there was an error updating the annotation', { variant: 'error' });
            },
        }
    );
};

export default useUpdateAnnotationById;

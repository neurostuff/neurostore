import { AxiosError, AxiosResponse } from 'axios';
import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from 'react-query';
import API, { NeurostoreAnnotation } from 'api/api.config';

const useCreateAnnotation = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation<
        AxiosResponse<NeurostoreAnnotation>,
        AxiosError,
        {
            source?:
                | 'neurostore'
                | 'neurovault'
                | 'pubmed'
                | 'neurosynth'
                | 'neuroquery'
                | undefined;
            sourceId?: string;
            annotation: Partial<NeurostoreAnnotation>;
        },
        unknown
    >(
        (args) =>
            API.NeurostoreServices.AnnotationsService.annotationsPost(
                args.source,
                args.sourceId,
                args.annotation
            ),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('annotations');
            },
            onError: () => {
                enqueueSnackbar('there was an error creating the annotation', { variant: 'error' });
            },
        }
    );
};

export default useCreateAnnotation;

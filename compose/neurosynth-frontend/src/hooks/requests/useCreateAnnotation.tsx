import { AxiosError, AxiosResponse } from 'axios';
import { Annotation, AnnotationReturn } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from 'react-query';
import API from 'utils/api';

const useCreateAnnotation = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation<
        AxiosResponse<AnnotationReturn>,
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
            annotation: Annotation;
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
                enqueueSnackbar('annotation created successfully', { variant: 'success' });
            },
            onError: () => {
                enqueueSnackbar('there was an error creating the annotation', { variant: 'error' });
            },
        }
    );
};

export default useCreateAnnotation;

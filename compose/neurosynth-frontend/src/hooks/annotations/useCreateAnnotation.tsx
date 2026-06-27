import API from 'api/api.config';
import { AxiosError } from 'axios';
import annotationQueries from 'hooks/annotations/annotationQueries';
import { AnnotationRequestOneOf } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from 'react-query';
import { AnnotationReturnOneOfWithNoteCollection } from './annotationQueries.types';

const useCreateAnnotation = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation<
        AnnotationReturnOneOfWithNoteCollection,
        AxiosError,
        {
            source?: 'neurostore' | 'neurovault' | 'pubmed' | 'neurosynth' | 'neuroquery' | undefined;
            sourceId?: string;
            annotation: Partial<AnnotationRequestOneOf>;
        },
        unknown
    >(
        async (args) => {
            const response = await API.NeurostoreServices.AnnotationsService.annotationsPost(
                args.source,
                args.sourceId,
                args.annotation
            );
            return response.data as AnnotationReturnOneOfWithNoteCollection;
        },
        {
            onSuccess: () => {
                queryClient.invalidateQueries(annotationQueries.all());
            },
            onError: () => {
                enqueueSnackbar('there was an error creating the annotation', { variant: 'error' });
            },
        }
    );
};

export default useCreateAnnotation;

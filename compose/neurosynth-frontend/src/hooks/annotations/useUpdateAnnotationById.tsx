import API from 'api/api.config';
import { AxiosError } from 'axios';
import { AnnotationRequestOneOf } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from 'react-query';
import annotationQueries from './annotationQueries';
import { AnnotationReturnOneOfWithNoteCollection } from './annotationQueries.types';

const useUpdateAnnotationById = (
    annotationId: string | undefined | null,
    options?: { invalidateOnSuccess?: boolean }
) => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();

    return useMutation<
        AnnotationReturnOneOfWithNoteCollection,
        AxiosError,
        {
            argAnnotationId: string;
            annotation: AnnotationRequestOneOf;
        },
        unknown
    >(
        async (update) => {
            const response = await API.NeurostoreServices.AnnotationsService.annotationsIdPut(
                update.argAnnotationId,
                update.annotation
            );
            return response.data as AnnotationReturnOneOfWithNoteCollection;
        },
        {
            mutationKey: annotationQueries.mutations.update(),
            onSuccess: (response) => {
                const invalidateOnSuccess = options?.invalidateOnSuccess ?? true;
                if (invalidateOnSuccess) {
                    queryClient.invalidateQueries(annotationQueries.byId(annotationId).queryKey);
                    queryClient.invalidateQueries(annotationQueries.lists());
                    return;
                }

                queryClient.setQueryData<AnnotationReturnOneOfWithNoteCollection>(
                    annotationQueries.byId(annotationId).queryKey,
                    response
                );
            },
            onError: () => {
                enqueueSnackbar('there was an error updating the annotation', { variant: 'error' });
            },
        }
    );
};

export default useUpdateAnnotationById;

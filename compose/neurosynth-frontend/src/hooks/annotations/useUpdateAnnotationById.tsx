import { useMutation, useQueryClient } from '@tanstack/react-query';
import API from 'api/api.config';
import { AxiosError } from 'axios';
import { AnnotationRequestOneOf } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import { AnnotationReturnOneOfWithNoteCollection } from './annotationQueries.types';
import annotationQueries from 'hooks/annotations/annotationQueries';

const useUpdateAnnotationById = (
    annotationId: string | undefined | null,
    options?: { invalidateOnSuccess?: boolean }
) => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();

    return useMutation<
        AnnotationReturnOneOfWithNoteCollection,
        AxiosError,
        { argAnnotationId: string; annotation: AnnotationRequestOneOf },
        unknown
    >({
        mutationFn: async (update) => {
            const response = await API.NeurostoreServices.AnnotationsService.annotationsIdPut(
                update.argAnnotationId,
                update.annotation
            );
            return response.data as AnnotationReturnOneOfWithNoteCollection;
        },
        mutationKey: annotationQueries.mutations.update(),
        onSuccess: (response) => {
            const invalidateOnSuccess = options?.invalidateOnSuccess ?? true;
            if (invalidateOnSuccess) {
                queryClient.invalidateQueries({ queryKey: annotationQueries.byId(annotationId).queryKey });
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
    });
};

export default useUpdateAnnotationById;

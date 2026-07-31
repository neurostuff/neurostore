import { AxiosError, AxiosResponse } from 'axios';
import { NoteCollectionRequest, NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import API from 'api/api.config';
import annotationQueries from 'hooks/annotations/annotationQueries';

const useUpdateAnnotationByAnnotationAndAnalysisIds = (
    annotationId: string | undefined | null,
    options?: { invalidateOnSuccess?: boolean }
) => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();

    return useMutation<AxiosResponse<NoteCollectionReturn[]>, AxiosError, NoteCollectionRequest[], unknown>({
        mutationFn: (update) => API.NeurostoreServices.AnalysesService.annotationAnalysesPost(update),
        onSuccess: () => {
            const invalidateOnSuccess = options?.invalidateOnSuccess ?? true;
            if (!invalidateOnSuccess) return;

            queryClient.invalidateQueries({ queryKey: annotationQueries.byId(annotationId).queryKey });
        },
        onError: () => {
            enqueueSnackbar('there was an error updating the annotation', { variant: 'error' });
        },
    });
};

export default useUpdateAnnotationByAnnotationAndAnalysisIds;

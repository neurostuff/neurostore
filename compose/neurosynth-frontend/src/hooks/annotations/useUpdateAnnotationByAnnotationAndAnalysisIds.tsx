import { AxiosError, AxiosResponse } from 'axios';
import { NoteCollectionRequest, NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from 'react-query';
import API from 'api/api.config';
import annotationQueries from './annotationQueries';

const useUpdateAnnotationByAnnotationAndAnalysisIds = (
    annotationId: string | undefined | null,
    options?: { invalidateOnSuccess?: boolean }
) => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();

    return useMutation<AxiosResponse<NoteCollectionReturn[]>, AxiosError, NoteCollectionRequest[], unknown>(
        (update) => API.NeurostoreServices.AnalysesService.annotationAnalysesPost(update),
        {
            onSuccess: () => {
                const invalidateOnSuccess = options?.invalidateOnSuccess ?? true;
                if (!invalidateOnSuccess) return;

                queryClient.invalidateQueries(annotationQueries.byId(annotationId).queryKey);
            },
            onError: () => {
                enqueueSnackbar('there was an error updating the annotation', { variant: 'error' });
            },
        }
    );
};

export default useUpdateAnnotationByAnnotationAndAnalysisIds;

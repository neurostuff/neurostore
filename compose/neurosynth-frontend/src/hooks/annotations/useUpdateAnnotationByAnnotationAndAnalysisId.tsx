import API from 'api/api.config';
import { AxiosError, AxiosResponse } from 'axios';
import { NoteCollectionRequest, NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const useUpdateAnnotationByAnnotationAndAnalysisId = (
    annotationId: string | undefined | null,
    options?: { invalidateOnSuccess?: boolean }
) => {
    const invalidateOnSuccess = options?.invalidateOnSuccess ?? true;
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();

    return useMutation<AxiosResponse<NoteCollectionReturn[]>, AxiosError, NoteCollectionRequest[], unknown>({
        mutationFn: (update) => API.NeurostoreServices.AnalysesService.annotationAnalysesPost(update),

        onSuccess: () => {
            if (invalidateOnSuccess) {
                queryClient.invalidateQueries({
                    queryKey: ['annotations', annotationId]
                });
            }
        },

        onError: () => {
            enqueueSnackbar('there was an error updating the annotation', { variant: 'error' });
        }
    });
};

export default useUpdateAnnotationByAnnotationAndAnalysisId;

import API from 'api/api.config';
import { AxiosError, AxiosResponse } from 'axios';
import { NoteCollectionRequest, NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from 'react-query';

const useUpdateAnnotationByAnnotationAndAnalysisId = (annotationId: string | undefined | null) => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();

    return useMutation<AxiosResponse<NoteCollectionReturn[]>, AxiosError, NoteCollectionRequest[], unknown>(
        (update) => API.NeurostoreServices.AnnotationsService.annotationAnalysesPost(update),
        {
            onSuccess: () => {
                queryClient.invalidateQueries(['annotations', annotationId]);
            },
            onError: () => {
                enqueueSnackbar('there was an error updating the annotation', { variant: 'error' });
            },
        }
    );
};

export default useUpdateAnnotationByAnnotationAndAnalysisId;

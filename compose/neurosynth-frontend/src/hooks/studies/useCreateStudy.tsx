import { AxiosError, AxiosResponse } from 'axios';
import { StudyReturn, StudyRequest } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import API from 'api/api.config';

const useCreateStudy = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation<
        AxiosResponse<StudyReturn>,
        AxiosError,
        { sourceId: string; data: StudyRequest },
        unknown
    >({
        mutationFn: ({ sourceId, data }) => API.NeurostoreServices.StudiesService.studiesPost(undefined, sourceId, data),

        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['studies']
            });
        },

        onError: () => {
            enqueueSnackbar('There was an error creating the study', { variant: 'error' });
        }
    });
};

export default useCreateStudy;

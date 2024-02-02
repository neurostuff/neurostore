import { AxiosError, AxiosResponse } from 'axios';
import { StudyReturn, StudyRequest } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from 'react-query';
import API from 'utils/api';

const useCreateStudy = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation<
        AxiosResponse<StudyReturn>,
        AxiosError,
        { sourceId: string; data: StudyRequest },
        unknown
    >(
        ({ sourceId, data }) =>
            API.NeurostoreServices.StudiesService.studiesPost(undefined, sourceId, data),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('studies');
            },
            onError: () => {
                enqueueSnackbar('There was an error creating the study', { variant: 'error' });
            },
        }
    );
};

export default useCreateStudy;

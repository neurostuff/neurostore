import { AxiosError, AxiosResponse } from 'axios';
import { Study, StudyReturn } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from 'react-query';
import API from 'utils/api';

const useCreateStudy = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation<AxiosResponse<StudyReturn>, AxiosError, string, unknown>(
        (studyId) =>
            API.NeurostoreServices.StudiesService.studiesPost(undefined, studyId, undefined),
        {
            onSuccess: () => {
                // update study
                queryClient.invalidateQueries('studysets');
                enqueueSnackbar('Created new study successfully', { variant: 'success' });
            },
            onError: () => {
                enqueueSnackbar('There was an error creating the study', { variant: 'error' });
            },
        }
    );
};

export default useCreateStudy;

import { AxiosError, AxiosResponse } from 'axios';
import { StudysetRequest, StudysetReturn } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from 'react-query';
import API from 'utils/api';

const useCreateStudyset = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation<AxiosResponse<StudysetReturn>, AxiosError, StudysetRequest, unknown>(
        (studyset) => API.NeurostoreServices.StudySetsService.studysetsPost(studyset),
        {
            onSuccess: () => {
                // update study
                queryClient.invalidateQueries('studysets');
                enqueueSnackbar('Created new studyset successfully', { variant: 'success' });
            },
            onError: () => {
                enqueueSnackbar('There was an error creating the studyset', { variant: 'error' });
            },
        }
    );
};

export default useCreateStudyset;

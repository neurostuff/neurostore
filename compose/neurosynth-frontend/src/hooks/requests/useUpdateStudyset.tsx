import { AxiosError, AxiosResponse } from 'axios';
import { useMutation, useQueryClient } from 'react-query';
import { Studyset, StudysetReturn } from 'neurostore-typescript-sdk';
import API from 'utils/api';
import { useSnackbar } from 'notistack';

const useUpdateStudyset = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation<
        AxiosResponse<StudysetReturn>,
        AxiosError,
        {
            studysetId: string;
            studyset: Studyset;
        },
        unknown
    >(
        (args) =>
            API.NeurostoreServices.StudySetsService.studysetsIdPut(args.studysetId, args.studyset),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('studysets');
                enqueueSnackbar('studyset updated successfully', { variant: 'success' });
            },
            onError: () => {
                enqueueSnackbar('there was an error updating the studyset', { variant: 'error' });
            },
        }
    );
};

export default useUpdateStudyset;

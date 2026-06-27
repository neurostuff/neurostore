import { AxiosError, AxiosResponse } from 'axios';
import { useMutation, useQueryClient } from 'react-query';
import { StudysetRequest, StudysetReturn } from 'neurostore-typescript-sdk';
import API from 'api/api.config';
import { useSnackbar } from 'notistack';
import studysetQueries from 'hooks/studysets/studysetQueries';

const useUpdateStudyset = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation<
        AxiosResponse<StudysetReturn>,
        AxiosError,
        {
            studysetId: string;
            studyset: StudysetRequest;
        },
        unknown
    >({
        mutationFn: (args) => API.NeurostoreServices.StudySetsService.studysetsIdPut(args.studysetId, args.studyset),
        onSuccess: () => {
            queryClient.invalidateQueries(studysetQueries.lists());
            queryClient.invalidateQueries(studysetQueries.details());
        },
        onError: () => {
            enqueueSnackbar('there was an error updating the studyset', { variant: 'error' });
        },
    });
};

export default useUpdateStudyset;

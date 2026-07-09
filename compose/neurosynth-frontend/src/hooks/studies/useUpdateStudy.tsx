import { AxiosError, AxiosResponse } from 'axios';
import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from 'react-query';
import { StudyRequest, StudyReturn } from 'neurostore-typescript-sdk';
import API from 'api/api.config';

const useUpdateStudy = () => {
    const { enqueueSnackbar } = useSnackbar();
    const queryClient = useQueryClient();
    return useMutation<
        AxiosResponse<StudyReturn>,
        AxiosError,
        {
            studyId: string;
            study: StudyRequest;
        },
        unknown
    >((args) => API.NeurostoreServices.StudiesService.studiesIdPut(args.studyId, args.study), {
        onSuccess: () => {
            queryClient.invalidateQueries('studies');
        },
        onError: () => {
            enqueueSnackbar('there was an error updating the study', { variant: 'error' });
        },
    });
};

export default useUpdateStudy;

import { useMutation, useQueryClient } from '@tanstack/react-query';
import API from 'api/api.config';
import { AxiosError, AxiosResponse } from 'axios';
import { StudyRequest, StudyReturn } from 'neurostore-typescript-sdk';
import { useSnackbar } from 'notistack';
import studyQueries from 'hooks/studies/studyQueries';

const useUpdateStudy = () => {
    const { enqueueSnackbar } = useSnackbar();
    const queryClient = useQueryClient();
    return useMutation<AxiosResponse<StudyReturn>, AxiosError, { studyId: string; study: StudyRequest }, unknown>({
        mutationFn: (args) => API.NeurostoreServices.StudiesService.studiesIdPut(args.studyId, args.study),
        mutationKey: studyQueries.mutations.update(),

        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: studyQueries.studies.details(),
            });
        },

        onError: () => {
            enqueueSnackbar('there was an error updating the study', { variant: 'error' });
        },
    });
};

export default useUpdateStudy;

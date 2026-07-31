import { AxiosError, AxiosResponse } from 'axios';
import { MetaAnalysisJobRequest, MetaAnalysisJobResponse } from 'neurosynth-compose-typescript-sdk';
import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import API from 'api/api.config';

const useSubmitMetaAnalysisJob = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation<AxiosResponse<MetaAnalysisJobResponse>, AxiosError, MetaAnalysisJobRequest, unknown>({
        mutationFn: (metaAnalysisJobRequest: MetaAnalysisJobRequest) =>
            API.NeurosynthServices.MetaAnalysisService.metaAnalysisJobsPost(metaAnalysisJobRequest),

        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: ['meta-analysis-jobs']
            });
        },

        onError: () => {
            enqueueSnackbar('There was an error creating the meta analysis job', { variant: 'error' });
        }
    });
};

export default useSubmitMetaAnalysisJob;

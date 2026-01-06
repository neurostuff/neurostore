import { MetaAnalysisJobRequest } from 'neurosynth-compose-typescript-sdk';
import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from 'react-query';
import API from 'api/api.config';

const useSubmitMetaAnalysisJob = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation(
        (metaAnalysisJobRequest: MetaAnalysisJobRequest) =>
            API.NeurosynthServices.MetaAnalysisService.neurosynthComposeResourcesMetaAnalysisJobsMetaAnalysisJobsResourcePost(
                metaAnalysisJobRequest
            ),
        {
            onSuccess: async () => {
                await queryClient.invalidateQueries('meta-analysis-jobs');
            },
            onError: () => {
                enqueueSnackbar('There was an error creating the meta analysis job', { variant: 'error' });
            },
        }
    );
};

export default useSubmitMetaAnalysisJob;

import { AxiosResponse, AxiosError } from 'axios';
import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnalysisRequest, AnalysisReturn } from 'neurostore-typescript-sdk';
import API from 'api/api.config';
import analysisQueries from 'hooks/analyses/analysisQueries';
import studyQueries from 'hooks/studies/studyQueries';

const useCreateAnalysis = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation<AxiosResponse<AnalysisReturn>, AxiosError, AnalysisRequest, unknown>({
        mutationFn: (analysis) => API.NeurostoreServices.AnalysesService.analysesPost(analysis),
        onSuccess: (res) => {
            const analysisId = res.data?.id;
            if (analysisId) {
                queryClient.invalidateQueries({ queryKey: analysisQueries.analyses.byId(analysisId).queryKey });
            }
            queryClient.invalidateQueries({ queryKey: analysisQueries.analyses.lists() });
            // TODO: when we convert CBMA to a save on action based workflow, we should remove this and invalidate the parent analysis instead
            queryClient.invalidateQueries({ queryKey: studyQueries.studies.all() });
            enqueueSnackbar('new analysis created successfully', { variant: 'success' });
        },
        onError: () => {
            enqueueSnackbar('there was an error creating the analysis', { variant: 'error' });
        },
    });
};

export default useCreateAnalysis;

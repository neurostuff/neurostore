import { AxiosError, AxiosResponse } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnalysisRequest, AnalysisReturn } from 'neurostore-typescript-sdk';
import API from 'api/api.config';
import { useSnackbar } from 'notistack';
import analysisQueries from 'hooks/analyses/analysisQueries';
import studyQueries from 'hooks/studies/studyQueries';

const useUpdateAnalysis = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();

    return useMutation<
        AxiosResponse<AnalysisReturn>,
        AxiosError,
        { analysisId: string; analysis: AnalysisRequest },
        unknown
    >({
        mutationFn: (args) => API.NeurostoreServices.AnalysesService.analysesIdPut(args.analysisId, args.analysis),
        mutationKey: analysisQueries.mutations.update(),
        onSuccess: (_res, variables) => {
            queryClient.invalidateQueries({ queryKey: analysisQueries.analyses.byId(variables.analysisId).queryKey });
            // TODO: when we convert CBMA to a save on action based workflow, we should remove this and invalidate the parent analysis instead
            queryClient.invalidateQueries({ queryKey: studyQueries.studies.all() });
        },

        onError: () => {
            enqueueSnackbar('there was an error updating the analysis', { variant: 'error' });
        },
    });
};

export default useUpdateAnalysis;

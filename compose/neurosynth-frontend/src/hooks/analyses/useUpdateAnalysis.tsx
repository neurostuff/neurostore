import { AxiosError, AxiosResponse } from 'axios';
import { useMutation, useQueryClient } from 'react-query';
import { AnalysisRequest, AnalysisReturn } from 'neurostore-typescript-sdk';
import API from 'utils/api';
import { useSnackbar } from 'notistack';

const useUpdateAnalysis = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();

    return useMutation<
        AxiosResponse<AnalysisReturn>,
        AxiosError,
        {
            analysisId: string;
            analysis: AnalysisRequest;
        },
        unknown
    >(
        (args) =>
            API.NeurostoreServices.AnalysesService.analysesIdPut(args.analysisId, args.analysis),
        {
            onSuccess: (res) => {
                queryClient.invalidateQueries('studies');
            },
            onError: () => {
                enqueueSnackbar('there was an error updating the analysis', { variant: 'error' });
            },
        }
    );
};

export default useUpdateAnalysis;

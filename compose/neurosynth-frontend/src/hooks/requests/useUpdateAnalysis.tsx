import { AxiosError, AxiosResponse } from 'axios';
import { useMutation, useQueryClient } from 'react-query';
import { Analysis, AnalysisReturn } from 'neurostore-typescript-sdk';
import API from 'utils/api';
import { GlobalContext, SnackbarType } from 'contexts/GlobalContext';
import { useContext } from 'react';

const useUpdateAnalysis = () => {
    const queryClient = useQueryClient();
    const { showSnackbar } = useContext(GlobalContext);

    return useMutation<
        AxiosResponse<AnalysisReturn>,
        AxiosError,
        {
            analysisId: string;
            analysis: Analysis;
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
                showSnackbar('there was an error', SnackbarType.ERROR);
            },
        }
    );
};

export default useUpdateAnalysis;

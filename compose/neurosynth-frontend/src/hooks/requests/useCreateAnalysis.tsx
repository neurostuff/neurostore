import { AxiosResponse, AxiosError } from 'axios';
import { useSnackbar } from 'notistack';
import { useMutation, useQueryClient } from 'react-query';
import { Analysis, AnalysisReturn } from 'neurostore-typescript-sdk';
import API from 'utils/api';

const useCreateAnalysis = () => {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation<AxiosResponse<AnalysisReturn>, AxiosError, Analysis, unknown>(
        (analysis) => API.NeurostoreServices.AnalysesService.analysesPost(analysis),
        {
            onSuccess: () => {
                // update study
                queryClient.invalidateQueries('studies');
                enqueueSnackbar('new analysis created successfully', { variant: 'success' });
            },
            onError: () => {
                enqueueSnackbar('there was an error creating the analysis', { variant: 'error' });
            },
        }
    );
};

export default useCreateAnalysis;

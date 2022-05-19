import { AxiosResponse, AxiosError } from 'axios';
import { useMutation, useQueryClient } from 'react-query';
import { Analysis, AnalysisReturn } from '../../neurostore-typescript-sdk';
import API from '../../utils/api';

const useCreateAnalysis = () => {
    const queryClient = useQueryClient();
    return useMutation<AxiosResponse<AnalysisReturn>, AxiosError, Analysis, unknown>(
        (analysis) => API.NeurostoreServices.AnalysesService.analysesPost(analysis),
        {
            onSuccess: () => {
                // update study
                queryClient.invalidateQueries('studies');
            },
        }
    );
};

export default useCreateAnalysis;

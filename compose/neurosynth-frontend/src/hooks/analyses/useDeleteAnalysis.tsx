import { AxiosError, AxiosResponse } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import API from 'api/api.config';

const useDeleteAnalysis = () => {
    const queryClient = useQueryClient();
    return useMutation<AxiosResponse<void>, AxiosError, string, unknown>({
        mutationFn: (id: string) => API.NeurostoreServices.AnalysesService.analysesIdDelete(id),

        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['studies']
            });
        }
    });
};

export default useDeleteAnalysis;

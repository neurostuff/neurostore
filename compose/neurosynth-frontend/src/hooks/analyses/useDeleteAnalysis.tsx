import { useMutation, useQueryClient } from 'react-query';
import API from 'api/api.config';

const useDeleteAnalysis = () => {
    const queryClient = useQueryClient();
    return useMutation((id: string) => API.NeurostoreServices.AnalysesService.analysesIdDelete(id), {
        onSuccess: () => {
            queryClient.invalidateQueries('studies');
        },
    });
};

export default useDeleteAnalysis;

import { useMutation, useQueryClient } from 'react-query';
import API from 'api/api.config';
import analysisQueries from 'hooks/analyses/analysisQueries';

const useDeleteAnalysis = () => {
    const queryClient = useQueryClient();
    return useMutation((id: string) => API.NeurostoreServices.AnalysesService.analysesIdDelete(id), {
        onSuccess: (_res, id) => {
            queryClient.removeQueries(analysisQueries.analyses.byId(id).queryKey);
            queryClient.invalidateQueries(analysisQueries.analyses.lists());
            // TODO: when we convert CBMA to a save on action based workflow, we should remove this and invalidate the parent analysis instead
            queryClient.invalidateQueries('studies');
        },
    });
};

export default useDeleteAnalysis;

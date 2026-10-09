import { useMutation, useQueryClient } from '@tanstack/react-query';
import API from 'api/api.config';
import analysisQueries from 'hooks/analyses/analysisQueries';
import studyQueries from 'hooks/studies/studyQueries';

const useDeleteAnalysis = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => API.NeurostoreServices.AnalysesService.analysesIdDelete(id),
        mutationKey: analysisQueries.mutations.delete(),
        onSuccess: (_res, id) => {
            queryClient.removeQueries({ queryKey: analysisQueries.analyses.byId(id).queryKey });
            queryClient.invalidateQueries({ queryKey: analysisQueries.analyses.lists() });
            // TODO: when we convert CBMA to a save on action based workflow, we should remove this and invalidate the parent analysis instead
            queryClient.invalidateQueries({ queryKey: studyQueries.studies.all() });
        },
    });
};

export default useDeleteAnalysis;

import { useMutation, useQueryClient } from 'react-query';
import API from 'api/api.config';
import analysisQueries from 'hooks/analyses/analysisQueries';

const useDeletePoint = () => {
    const queryClient = useQueryClient();
    return useMutation((id: string) => API.NeurostoreServices.PointsService.pointsIdDelete(id), {
        onSuccess: () => {
            queryClient.invalidateQueries(analysisQueries.points.all().queryKey);
            // TODO: when we convert CBMA to a save on action based workflow, we should remove this and invalidate the parent analysis instead
            queryClient.invalidateQueries('studies');
        },
    });
};

export default useDeletePoint;

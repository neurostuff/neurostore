import { useMutation, useQueryClient } from 'react-query';
import API from 'api/api.config';
import analysisQueries from 'hooks/analyses/analysisQueries';

const useCreatePoint = () => {
    const queryClient = useQueryClient();
    return useMutation(
        (analysisId: string) =>
            API.NeurostoreServices.PointsService.pointsPost({
                coordinates: [0, 0, 0],
                analysis: analysisId,
            }),
        {
            onSuccess: () => {
                queryClient.invalidateQueries(analysisQueries.points.all().queryKey);
                // TODO: when we convert CBMA to a save on action based workflow, we should remove this and invalidate the parent analysis instead
                queryClient.invalidateQueries('studies');
            },
        }
    );
};

export default useCreatePoint;

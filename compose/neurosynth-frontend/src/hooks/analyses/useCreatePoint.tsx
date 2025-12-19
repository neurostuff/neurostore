import { useMutation, useQueryClient } from 'react-query';
import API from 'api/api.config';

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
                // we need to send a request to retrieve studies again with its associated analyses and points
                queryClient.invalidateQueries('studies');
            },
        }
    );
};

export default useCreatePoint;

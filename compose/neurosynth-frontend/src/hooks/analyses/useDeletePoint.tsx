import { useMutation, useQueryClient } from 'react-query';
import API from 'api/api.config';

const useDeletePoint = () => {
    const queryClient = useQueryClient();
    return useMutation((id: string) => API.NeurostoreServices.PointsService.pointsIdDelete(id), {
        onSuccess: () => {
            // we need to send a request to retrieve studies again with its associated analyses and points
            queryClient.invalidateQueries('studies');
        },
    });
};

export default useDeletePoint;

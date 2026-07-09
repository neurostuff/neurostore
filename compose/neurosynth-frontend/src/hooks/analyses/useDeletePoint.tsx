import { AxiosError, AxiosResponse } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import API from 'api/api.config';

const useDeletePoint = () => {
    const queryClient = useQueryClient();
    return useMutation<AxiosResponse<void>, AxiosError, string, unknown>({
        mutationFn: (id: string) => API.NeurostoreServices.PointsService.pointsIdDelete(id),

        onSuccess: () => {
            // we need to send a request to retrieve studies again with its associated analyses and points
            queryClient.invalidateQueries({
                queryKey: ['studies']
            });
        }
    });
};

export default useDeletePoint;

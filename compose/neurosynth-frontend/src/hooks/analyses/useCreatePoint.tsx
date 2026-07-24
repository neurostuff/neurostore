import { AxiosError, AxiosResponse } from 'axios';
import { PointReturn } from 'neurostore-typescript-sdk';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import API from 'api/api.config';

const useCreatePoint = () => {
    const queryClient = useQueryClient();
    return useMutation<AxiosResponse<PointReturn>, AxiosError, string, unknown>({
        mutationFn: (analysisId: string) =>
            API.NeurostoreServices.PointsService.pointsPost({
                coordinates: [0, 0, 0],
                analysis: analysisId,
            }),

        onSuccess: () => {
            // we need to send a request to retrieve studies again with its associated analyses and points
            queryClient.invalidateQueries({
                queryKey: ['studies']
            });
        }
    });
};

export default useCreatePoint;

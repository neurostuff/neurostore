import { AxiosResponse, AxiosError } from 'axios';
import { PointRequest, PointReturn } from 'neurostore-typescript-sdk';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import API from 'api/api.config';

const useUpdatePoint = () => {
    const queryClient = useQueryClient();
    return useMutation<
        AxiosResponse<PointReturn>,
        AxiosError,
        { pointId: string; point: PointRequest },
        unknown
    >({
        mutationFn: (args) => API.NeurostoreServices.PointsService.pointsIdPut(args.pointId, args.point),

        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ['studies']
            });
        }
    });
};

export default useUpdatePoint;

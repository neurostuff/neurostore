import { AxiosResponse, AxiosError } from 'axios';
import { PointRequest, PointReturn } from 'neurostore-typescript-sdk';
import { useMutation, useQueryClient } from 'react-query';
import API from 'utils/api';

const useUpdatePoint = () => {
    const queryClient = useQueryClient();
    return useMutation<
        AxiosResponse<PointReturn>,
        AxiosError,
        {
            pointId: string;
            point: PointRequest;
        },
        unknown
    >((args) => API.NeurostoreServices.PointsService.pointsIdPut(args.pointId, args.point), {
        onSuccess: () => {
            queryClient.invalidateQueries('studies');
        },
    });
};

export default useUpdatePoint;

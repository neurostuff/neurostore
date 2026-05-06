import { AxiosResponse, AxiosError } from 'axios';
import { PointRequest, PointReturn } from 'neurostore-typescript-sdk';
import { useMutation, useQueryClient } from 'react-query';
import API from 'api/api.config';
import analysisQueries from 'hooks/analyses/analysisQueries';

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
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries(analysisQueries.points.all().queryKey);
            queryClient.invalidateQueries(analysisQueries.analyses.byId(variables.point.analysis).queryKey);
            // TODO: when we convert CBMA to a save on action based workflow, we should remove this and invalidate the parent analysis instead
            queryClient.invalidateQueries('studies');
        },
    });
};

export default useUpdatePoint;

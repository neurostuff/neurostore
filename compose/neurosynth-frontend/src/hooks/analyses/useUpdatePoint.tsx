import { AxiosResponse, AxiosError } from 'axios';
import { PointRequest, PointReturn } from 'neurostore-typescript-sdk';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import API from 'api/api.config';
import analysisQueries from 'hooks/analyses/analysisQueries';
import studyQueries from 'hooks/studies/studyQueries';

const useUpdatePoint = () => {
    const queryClient = useQueryClient();
    return useMutation<AxiosResponse<PointReturn>, AxiosError, { pointId: string; point: PointRequest }, unknown>({
        mutationFn: (args) => API.NeurostoreServices.PointsService.pointsIdPut(args.pointId, args.point),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: analysisQueries.points.all() });
            queryClient.invalidateQueries({
                queryKey: analysisQueries.analyses.byId(variables.point.analysis).queryKey,
            });
            // TODO: when we convert CBMA to a save on action based workflow, we should remove this and invalidate the parent analysis instead
            queryClient.invalidateQueries({ queryKey: studyQueries.studies.all() });
        },
    });
};

export default useUpdatePoint;

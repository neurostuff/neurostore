import { useMutation, useQueryClient } from '@tanstack/react-query';
import API from 'api/api.config';
import { AxiosError, AxiosResponse } from 'axios';
import studyQueries from 'hooks/studies/studyQueries';

const useDeletePoint = () => {
    const queryClient = useQueryClient();
    return useMutation<AxiosResponse<void>, AxiosError, string, unknown>({
        mutationFn: (id: string) => API.NeurostoreServices.PointsService.pointsIdDelete(id),

        onSuccess: () => {
            // we need to send a request to retrieve studies again with its associated analyses and points
            queryClient.invalidateQueries({
                queryKey: studyQueries.studies.all(),
            });
        },
    });
};

export default useDeletePoint;

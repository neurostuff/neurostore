import { useQuery } from 'react-query';
import API from 'api/api.config';

const useGetPoints = () => {
    return useQuery(
        ['points'],
        () => {
            return API.NeurostoreServices.PointsService.pointsGet();
        },
        {
            select: (res) => {
                const pointsList = res.data;
                return pointsList;
            },
            refetchOnWindowFocus: false,
            staleTime: 10000,
        }
    );
};

export default useGetPoints;

import { useQuery } from '@tanstack/react-query';
import API from 'api/api.config';

const useGetConditions = () => {
    return useQuery({
        queryKey: ['conditions'],
        queryFn: () => API.NeurostoreServices.ConditionsService.conditionsGet(),
        select: (res) => res.data.results,
        staleTime: 5000
    });
};

export default useGetConditions;

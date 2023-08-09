import { useQuery } from 'react-query';
import API from 'utils/api';

const useGetConditions = () => {
    return useQuery('conditions', () => API.NeurostoreServices.ConditionsService.conditionsGet(), {
        select: (res) => res.data.results,
        staleTime: 5000,
    });
};

export default useGetConditions;

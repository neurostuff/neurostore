import { useQuery } from 'react-query';
import analysisQueries from './analysisQueries';

const useGetConditions = () => {
    const query = analysisQueries.conditions.all();
    return useQuery(query.queryKey, query.queryFn, { enabled: query.enabled, staleTime: 5000 });
};

export default useGetConditions;

import { useQuery } from 'react-query';
import analysisQueries from './analysisQueries';

const useGetPoints = () => {
    const query = analysisQueries.points.every();
    return useQuery(query.queryKey, query.queryFn, {
        enabled: query.enabled,
        refetchOnWindowFocus: false,
        staleTime: 10000,
    });
};

export default useGetPoints;

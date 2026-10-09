import { useQuery } from '@tanstack/react-query';
import analysisQueries from './analysisQueries';

const useGetPoints = () => {
    return useQuery({ ...analysisQueries.points.every(), refetchOnWindowFocus: false, staleTime: 10000 });
};

export default useGetPoints;

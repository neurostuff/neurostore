import { useQuery } from 'react-query';
import analysisQueries from 'hooks/analyses/analysisQueries';

const useGetAnalysisById = (analysisId: string | undefined) => {
    const query = analysisQueries.analyses.byId(analysisId);
    return useQuery(query.queryKey, query.queryFn, { enabled: query.enabled });
};

export default useGetAnalysisById;

import { useQuery } from '@tanstack/react-query';
import analysisQueries from 'hooks/analyses/analysisQueries';

const useGetAnalysisById = (analysisId: string | undefined) => {
    return useQuery(analysisQueries.analyses.byId(analysisId));
};

export default useGetAnalysisById;

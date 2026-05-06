import { useQuery } from 'react-query';
import analysisQueries from 'hooks/analyses/analysisQueries';

const useGetAnalysesByStudyId = (studyId: string | undefined) => {
    const query = analysisQueries.analyses.byStudyId(studyId);
    return useQuery(query.queryKey, query.queryFn, { enabled: query.enabled });
};

export default useGetAnalysesByStudyId;

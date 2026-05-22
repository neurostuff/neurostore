import analysisQueries from './analysisQueries';
import { useQuery } from 'react-query';

const useGetUncategorizedImagesByStudyId = (studyId: string | undefined) => {
    const query = analysisQueries.images.uncategorizedByStudyId(studyId);
    return useQuery(query.queryKey, query.queryFn, { enabled: query.enabled });
};

export default useGetUncategorizedImagesByStudyId;

import { useQuery } from 'react-query';
import annotationQueries from 'hooks/annotations/annotationQueries';

const useGetAnnotationsByStudysetId = (studysetId: string | undefined | null) => {
    const query = annotationQueries.byStudyset(studysetId);
    return useQuery(query.queryKey, query.queryFn, {
        enabled: query.enabled,
    });
};

export default useGetAnnotationsByStudysetId;

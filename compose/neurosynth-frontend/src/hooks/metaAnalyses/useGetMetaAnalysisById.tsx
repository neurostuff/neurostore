import { useQuery } from '@tanstack/react-query';
import metaAnalysisQueries from 'hooks/metaAnalyses/metaAnalysisQueries';

const useGetMetaAnalysisById = (metaAnalysisId: string | undefined) => {
    return useQuery(metaAnalysisQueries.byIdNonNested(metaAnalysisId));
};

export default useGetMetaAnalysisById;

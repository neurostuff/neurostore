import { useQuery } from '@tanstack/react-query';
import API from 'api/api.config';

const useGetMetaAnalysisById = (metaAnalysisId: string | undefined) => {
    const query = useQuery({
        queryKey: ['meta-analyses', metaAnalysisId],
        queryFn: () => API.NeurosynthServices.MetaAnalysisService.metaAnalysesIdGet(metaAnalysisId || '', false),
        enabled: !!metaAnalysisId,
        select: (data) => data.data
    });
    return query;
};

export default useGetMetaAnalysisById;

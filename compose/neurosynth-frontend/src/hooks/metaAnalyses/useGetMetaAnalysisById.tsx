import { useQuery } from 'react-query';
import API from 'api/api.config';

const useGetMetaAnalysisById = (metaAnalysisId: string | undefined) => {
    const query = useQuery(
        ['meta-analyses', metaAnalysisId],
        () => API.NeurosynthServices.MetaAnalysisService.metaAnalysesIdGet(metaAnalysisId || '', true),
        {
            enabled: !!metaAnalysisId,
            select: (data) => data.data,
        }
    );
    return query;
};

export default useGetMetaAnalysisById;

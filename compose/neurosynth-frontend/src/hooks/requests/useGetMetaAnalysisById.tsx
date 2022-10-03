import { useQuery } from 'react-query';
import API from 'utils/api';

const useGetMetaAnalysisById = (metaAnalysisId: string) => {
    const query = useQuery(
        ['meta-analyses', metaAnalysisId],
        () => API.NeurosynthServices.MetaAnalysisService.metaAnalysesIdGet(metaAnalysisId, true),
        {
            select: (data) => data.data,
        }
    );
    return query;
};

export default useGetMetaAnalysisById;

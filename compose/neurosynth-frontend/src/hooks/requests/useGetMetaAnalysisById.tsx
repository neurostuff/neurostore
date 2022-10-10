import { useQuery } from 'react-query';
import API from 'utils/api';

const useGetMetaAnalysisById = (metaAnalysisId: string) => {
    return useQuery(
        ['meta-analyses', metaAnalysisId],
        () => API.NeurosynthServices.MetaAnalysisService.metaAnalysesIdGet(metaAnalysisId, true),
        {
            select: (data) => data.data,
        }
    );
};

export default useGetMetaAnalysisById;

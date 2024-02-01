import { useQuery } from 'react-query';
import API from 'utils/api';

const useGetMetaAnalysesByIds = (metaAnalysisIds: string[] | undefined) => {
    return useQuery(
        ['meta-analyses', metaAnalysisIds],
        () =>
            API.NeurosynthServices.MetaAnalysisService.metaAnalysesGet(
                false,
                metaAnalysisIds || []
            ),
        {
            select: (axiosResponse) => {
                const res = axiosResponse.data.results || [];
                return res;
            },
        }
    );
};

export default useGetMetaAnalysesByIds;

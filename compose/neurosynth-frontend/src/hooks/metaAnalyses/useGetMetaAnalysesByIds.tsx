import { lastUpdatedAtSortFn } from 'helpers/utils';
import { useQuery } from 'react-query';
import API from 'api/api.config';

const useGetMetaAnalysesByIds = (metaAnalysisIds: string[] | undefined) => {
    return useQuery(
        ['meta-analyses', metaAnalysisIds],
        () => API.NeurosynthServices.MetaAnalysisService.metaAnalysesGet(false, metaAnalysisIds),
        {
            select: (axiosResponse) => {
                const res = (axiosResponse.data.results || []).sort(lastUpdatedAtSortFn).reverse();
                return res;
            },
            refetchOnWindowFocus: false,
            enabled: metaAnalysisIds && metaAnalysisIds.length > 0,
        }
    );
};

export default useGetMetaAnalysesByIds;

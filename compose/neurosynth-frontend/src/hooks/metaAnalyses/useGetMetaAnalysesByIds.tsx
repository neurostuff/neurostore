import { lastUpdatedAtSortFn } from 'components/Dialogs/MoveToExtractionDialog/MovetoExtractionDialog.helpers';
import { useQuery } from 'react-query';
import API from 'utils/api';

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

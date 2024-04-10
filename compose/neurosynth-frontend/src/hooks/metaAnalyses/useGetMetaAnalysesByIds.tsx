import { lastUpdatedAtSortFn } from 'components/Dialogs/MoveToExtractionDialog/MovetoExtractionDialog.helpers';
import { useQuery } from 'react-query';
import API from 'utils/api';

const useGetMetaAnalysesByIds = (metaAnalysisIds: string[] | undefined) => {
    const shouldFetch = metaAnalysisIds && metaAnalysisIds.length > 0;

    const result = useQuery(
        ['meta-analyses', metaAnalysisIds],
        () => API.NeurosynthServices.MetaAnalysisService.metaAnalysesGet(false, metaAnalysisIds),
        {
            select: (axiosResponse) => {
                const res = (axiosResponse.data.results || []).sort(lastUpdatedAtSortFn).reverse();
                return res;
            },
            enabled: shouldFetch,
        }
    );

    if (!shouldFetch) {
        return {
            data: [],
            isLoading: false,
            isError: false,
        };
    }

    return result;
};

export default useGetMetaAnalysesByIds;

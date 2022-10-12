import { useQuery } from 'react-query';
import API from 'utils/api';

const useGetMetaAnalyses = (userId?: string) => {
    return useQuery(
        ['meta-analyses', userId],
        () => API.NeurosynthServices.MetaAnalysisService.metaAnalysesGet(false),
        {
            select: (axiosResponse) => {
                const res = axiosResponse.data.results || [];
                return userId ? res.filter((x) => x.user === userId) : res;
            },
        }
    );
};

export default useGetMetaAnalyses;

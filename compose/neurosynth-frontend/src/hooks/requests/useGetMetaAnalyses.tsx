import { useQuery } from 'react-query';
import API from 'utils/api';

const useGetMetaAnalysesByProjectId = (projectId?: string) => {
    return useQuery(
        ['meta-analyses', projectId],
        () => API.NeurosynthServices.MetaAnalysisService.metaAnalysesGet(false),
        {
            select: (axiosResponse) => {
                const res = axiosResponse.data.results || [];
                return projectId ? res.filter((x) => x.project === projectId) : res;
            },
        }
    );
};

export default useGetMetaAnalysesByProjectId;

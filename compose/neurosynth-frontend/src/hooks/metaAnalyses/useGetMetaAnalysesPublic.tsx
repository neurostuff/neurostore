import { useQuery } from 'react-query';
import API from 'api/api.config';

const useGetMetaAnalysesPublic = () => {
    const result = useQuery(
        ['meta-analyses', 'public'],
        () => API.NeurosynthServices.MetaAnalysisService.metaAnalysesGet(false),
        {
            select: (axiosResponse) => {
                const res = axiosResponse.data.results || [];
                return res;
            },
        }
    );

    return result;
};

export default useGetMetaAnalysesPublic;

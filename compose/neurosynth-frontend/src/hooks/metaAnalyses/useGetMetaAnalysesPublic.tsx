import { useQuery } from '@tanstack/react-query';
import API from 'api/api.config';
import { MetaAnalysisReturn } from 'neurosynth-compose-typescript-sdk/api';

export interface MetaAnalysisPublicReturn {
    metadata: {
        total_count: number;
    };
    results: MetaAnalysisReturn[];
}

const useGetMetaAnalysesPublic = () => {
    const result = useQuery({
        queryKey: ['meta-analyses', 'public'],
        queryFn: () => API.NeurosynthServices.MetaAnalysisService.metaAnalysesGet(false),

        select: (axiosResponse) => {
            return axiosResponse.data as MetaAnalysisPublicReturn;
        },
    });

    return result;
};

export default useGetMetaAnalysesPublic;

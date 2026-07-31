import { AxiosResponse } from 'axios';
import { ResultReturn } from 'neurosynth-compose-typescript-sdk';
import { useQuery } from '@tanstack/react-query';
import API from 'api/api.config';

const useGetMetaAnalysisResultById = (metaAnalysisResultId: string | undefined | null) => {
    return useQuery({
        queryKey: ['meta-analyses-result', metaAnalysisResultId],
        queryFn: () => API.NeurosynthServices.MetaAnalysisService.metaAnalysisResultsIdGet(metaAnalysisResultId || ''),
        select: (res: AxiosResponse<ResultReturn>) => res.data,
        enabled: !!metaAnalysisResultId
    });
};

export default useGetMetaAnalysisResultById;

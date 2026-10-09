import { UseQueryOptions } from '@tanstack/react-query';
import API from 'api/api.config';
import { MetaAnalysisReturnNonNested } from 'hooks/metaAnalyses/metaAnalysisQueries.types';

const metaAnalysisQueries = {
    all: () => ['meta-analyses'] as const,

    details: () => [...metaAnalysisQueries.all(), 'detail'] as const,

    /** GET /meta-analyses/:id with `nested=true`. */
    byIdNonNested: (metaAnalysisId: string | undefined | null): UseQueryOptions<MetaAnalysisReturnNonNested> => ({
        queryKey: [...metaAnalysisQueries.details(), metaAnalysisId] as const,
        queryFn: async () => {
            const res = await API.NeurosynthServices.MetaAnalysisService.metaAnalysesIdGet(metaAnalysisId || '', false);
            return res.data as MetaAnalysisReturnNonNested;
        },
        enabled: !!metaAnalysisId,
    }),
};

export default metaAnalysisQueries;

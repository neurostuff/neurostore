import { useQuery } from '@tanstack/react-query';
import API from 'api/api.config';

const useGetMetaAnalysisJobById = (metaAnalysisJobId: string | undefined, enabled: boolean = true) => {
    return useQuery({
        queryKey: ['meta-analysis-jobs', metaAnalysisJobId],
        queryFn: () => API.NeurosynthServices.MetaAnalysisService.metaAnalysisJobsJobIdGet(metaAnalysisJobId as string),
        select: (data) => data.data,
        enabled: enabled && !!metaAnalysisJobId
    });
};

export default useGetMetaAnalysisJobById;

import { useQuery } from 'react-query';
import API from 'api/api.config';

const useGetMetaAnalysisJobById = (metaAnalysisJobId: string | undefined, enabled: boolean = true) => {
    return useQuery(
        ['meta-analysis-jobs', metaAnalysisJobId],
        () => API.NeurosynthServices.MetaAnalysisService.metaAnalysisJobsJobIdGet(metaAnalysisJobId as string),
        {
            select: (data) => data.data,
            enabled: enabled && !!metaAnalysisJobId,
        }
    );
};

export default useGetMetaAnalysisJobById;

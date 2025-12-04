import { useQuery } from 'react-query';
import API from 'utils/api';

const useGetMetaAnalysisJobById = (metaAnalysisJobId: string) => {
    return useQuery(
        ['meta-analysis-jobs', metaAnalysisJobId],
        () =>
            API.NeurosynthServices.MetaAnalysisService.neurosynthComposeResourcesMetaAnalysisJobsMetaAnalysisJobResourceGet(
                metaAnalysisJobId
            ),
        {
            select: (data) => data.data,
            enabled: !!metaAnalysisJobId,
        }
    );
};

export default useGetMetaAnalysisJobById;

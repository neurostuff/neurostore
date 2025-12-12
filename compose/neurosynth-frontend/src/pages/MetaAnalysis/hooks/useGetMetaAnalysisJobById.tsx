import { useQuery } from 'react-query';
import API from 'utils/api';

const useGetMetaAnalysisJobById = (metaAnalysisJobId: string | undefined) => {
    return useQuery(
        ['meta-analysis-jobs', metaAnalysisJobId],
        () =>
            API.NeurosynthServices.MetaAnalysisService.neurosynthComposeResourcesMetaAnalysisJobsMetaAnalysisJobResourceGet(
                metaAnalysisJobId as string
            ),
        {
            select: (data) => data.data,
            enabled: !!metaAnalysisJobId,
        }
    );
};

export default useGetMetaAnalysisJobById;

import { useQuery } from 'react-query';
import API from 'utils/api';

const useGetMetaAnalysisJobs = () => {
    return useQuery(
        ['meta-analysis-jobs'],
        () =>
            API.NeurosynthServices.MetaAnalysisService.neurosynthComposeResourcesMetaAnalysisJobsMetaAnalysisJobsResourceGet(),
        {
            select: (data) => data.data,
        }
    );
};

export default useGetMetaAnalysisJobs;

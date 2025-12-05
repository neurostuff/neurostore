import { useQuery } from 'react-query';
import API from 'utils/api';

/**
 * TODO: We may need to add a backend fix that only retrieves jobs for a specific
 * meta-analysis ID. For a user that runs many, many jobs, the JSON will grow quite large.
 *
 * ...though maybe this wont be an issue if the data is purged after a certain amount of time.
 */

const useGetMetaAnalysisJobsByMetaAnalysisId = (metaAnalysisId: string | undefined) => {
    return useQuery(
        ['meta-analysis-jobs', metaAnalysisId],
        async () => {
            const res =
                await API.NeurosynthServices.MetaAnalysisService.neurosynthComposeResourcesMetaAnalysisJobsMetaAnalysisJobsResourceGet();
            return res.data.results
                ?.filter((job) => job.meta_analysis_id === metaAnalysisId)
                .sort((a, b) => new Date(a.created_at ?? '').getTime() - new Date(b.created_at ?? '').getTime());
        },
        {
            enabled: !!metaAnalysisId,
        }
    );
};

export default useGetMetaAnalysisJobsByMetaAnalysisId;

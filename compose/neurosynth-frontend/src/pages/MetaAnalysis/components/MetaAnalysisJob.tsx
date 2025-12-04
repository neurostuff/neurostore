import { MetaAnalysisJobResponse } from 'neurosynth-compose-typescript-sdk';

const MetaAnalysisJob: React.FC<{
    metaAnalysisJobs: Array<MetaAnalysisJobResponse>;
}> = ({ metaAnalysisJobs }) => {
    const latestJob = metaAnalysisJobs.length > 0 ? metaAnalysisJobs[metaAnalysisJobs.length - 1] : undefined;

    if (!latestJob) return null;

    return (
        <>
            {latestJob.job_id}: {latestJob.status}
        </>
    );
};

export default MetaAnalysisJob;

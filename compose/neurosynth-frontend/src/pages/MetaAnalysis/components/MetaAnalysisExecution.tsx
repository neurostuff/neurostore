import { MetaAnalysisJobResponse, MetaAnalysisReturn, ResultReturn } from 'neurosynth-compose-typescript-sdk';
import RunMetaAnalysisInstructions from './RunMetaAnalysisInstructions';
import MetaAnalysisJob from './MetaAnalysisJob';
import DisplayMetaAnalysisResults from './DisplayMetaAnalysisResults';
import { useGetMetaAnalysisResultById } from 'hooks';
import useGetMetaAnalysisJobById from '../hooks/useGetMetaAnalysisJobById';
import ProgressLoader from 'components/ProgressLoader';
import { Box, Typography } from '@mui/material';

function MetaAnalysisExecution({
    metaAnalysis,
    metaAnalysisJobs,
}: {
    metaAnalysis?: MetaAnalysisReturn;
    metaAnalysisJobs?: Array<MetaAnalysisJobResponse>;
}) {
    const results = (metaAnalysis?.results ?? []) as ResultReturn[];
    const jobs = metaAnalysisJobs ?? [];
    const latestJob = jobs.length > 0 ? jobs[jobs.length - 1] : undefined;
    const latestResult = results.length > 0 ? results[results.length - 1] : undefined;

    const {
        data: latestResultData,
        isLoading: latestResultIsLoading,
        isError: latestResultIsError,
    } = useGetMetaAnalysisResultById(latestResult?.id);
    const {
        data: latestJobData,
        isLoading: latestJobIsLoading,
        isError: latestJobIsError,
    } = useGetMetaAnalysisJobById(latestJob?.job_id);

    if (latestResultIsLoading || latestJobIsLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <ProgressLoader />
            </Box>
        );
    }

    if (latestResultIsError || latestJobIsError) {
        return <Typography color="error">Error loading latest result or job</Typography>;
    }

    if (latestJob && !latestResult) {
        // has a job, no result yet
        return <MetaAnalysisJob metaAnalysisJobData={latestJobData} />;
    } else if (!latestJob && latestResult) {
        // no job, has a result
        return <DisplayMetaAnalysisResults metaAnalysis={metaAnalysis} />;
    } else if (latestJob && latestResult) {
        // has a job and a result, pick whatever was created first. Default to last result
        const jobCreated = latestJobData?.created_at ? new Date(latestJobData.created_at) : undefined;
        const resultCreated = latestResultData?.created_at ? new Date(latestResultData.created_at) : undefined;
        if (jobCreated && resultCreated && jobCreated > resultCreated) {
            return <MetaAnalysisJob metaAnalysisJobData={latestJobData} />;
        } else {
            return <DisplayMetaAnalysisResults metaAnalysis={metaAnalysis} />;
        }
    } else {
        // no job and no result
        return <RunMetaAnalysisInstructions metaAnalysisId={metaAnalysis?.id ?? ''} />;
    }
}

export default MetaAnalysisExecution;

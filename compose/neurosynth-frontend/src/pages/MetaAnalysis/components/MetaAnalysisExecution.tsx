import { Box, Typography } from '@mui/material';
import ProgressLoader from 'components/ProgressLoader';
import { getLatestMetaAnalysisResultId } from 'helpers/MetaAnalysis.helpers';
import { useGetMetaAnalysisResultById } from 'hooks';
import { MetaAnalysisJobResponse, MetaAnalysisReturn } from 'neurosynth-compose-typescript-sdk';
import useGetMetaAnalysisJobById from '../hooks/useGetMetaAnalysisJobById';
import DisplayMetaAnalysisResults from './DisplayMetaAnalysisResults';
import MetaAnalysisInstructions from './MetaAnalysisInstructions';
import MetaAnalysisJob from './MetaAnalysisJob';

function MetaAnalysisExecution({
    metaAnalysis,
    metaAnalysisJobs,
}: {
    metaAnalysis?: MetaAnalysisReturn;
    metaAnalysisJobs?: Array<MetaAnalysisJobResponse>;
}) {
    const jobs = metaAnalysisJobs ?? [];
    const latestJob = jobs.length > 0 ? jobs[jobs.length - 1] : undefined;
    const latestResultId = getLatestMetaAnalysisResultId(metaAnalysis);

    const {
        data: latestResultData,
        isLoading: latestResultIsLoading,
        isError: latestResultIsError,
    } = useGetMetaAnalysisResultById(latestResultId);
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

    if (latestJob && !latestResultId) {
        // has a job, no result yet
        return <MetaAnalysisJob metaAnalysisJobData={latestJobData} />;
    } else if (!latestJob && latestResultId) {
        // no job, has a result
        return <DisplayMetaAnalysisResults metaAnalysis={metaAnalysis} />;
    } else if (latestJob && latestResultId) {
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
        return <MetaAnalysisInstructions metaAnalysisId={metaAnalysis?.id ?? ''} />;
    }
}

export default MetaAnalysisExecution;

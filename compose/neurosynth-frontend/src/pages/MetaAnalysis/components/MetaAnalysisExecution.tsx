import { Box, Typography } from '@mui/material';
import ProgressLoader from 'components/ProgressLoader';
import { useGetMetaAnalysisResultById } from 'hooks';
import { MetaAnalysisJobResponse, MetaAnalysisReturn, ResultReturn } from 'neurosynth-compose-typescript-sdk';
import { useParams } from 'react-router-dom';
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
    const { projectId } = useParams<{ projectId: string }>();

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

    const isViewingThisPageFromProject = !projectId;

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

    // for users that do not own the meta-analysis/project
    if (isViewingThisPageFromProject) {
        return latestResult ? (
            <DisplayMetaAnalysisResults metaAnalysis={metaAnalysis} />
        ) : (
            <Typography>No results for this meta-analysis yet</Typography>
        );
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
        return <MetaAnalysisInstructions metaAnalysisId={metaAnalysis?.id ?? ''} />;
    }
}

export default MetaAnalysisExecution;

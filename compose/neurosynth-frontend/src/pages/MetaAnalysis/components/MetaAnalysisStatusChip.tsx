import { Chip, CircularProgress, Tooltip } from '@mui/material';
import { getLatestMetaAnalysisResultId, getResultStatus } from 'helpers/MetaAnalysis.helpers';
import { useGetMetaAnalysisResultById, useUserCanEdit } from 'hooks';
import { MetaAnalysisReturn } from 'neurosynth-compose-typescript-sdk';
import { useMemo } from 'react';
import { useProjectUser } from 'stores/projects/ProjectStore';
import useGetMetaAnalysisJobById from '../hooks/useGetMetaAnalysisJobById';
import useGetMetaAnalysisJobsByMetaAnalysisId from '../hooks/useGetMetaAnalysisJobsByMetaAnalysisId';

const MetaAnalysisStatusChip = ({ metaAnalysis }: { metaAnalysis?: MetaAnalysisReturn }) => {
    const projectUser = useProjectUser();
    const canEditProject = useUserCanEdit(projectUser || undefined);
    const canEditMetaAnalysis = useUserCanEdit(metaAnalysis?.user || undefined);
    const canLoadJobs = canEditProject || canEditMetaAnalysis;
    const {
        data: metaAnalysisJobs,
        isLoading: metaAnalysisJobsIsLoading,
        isError: metaAnalysisJobsIsError,
    } = useGetMetaAnalysisJobsByMetaAnalysisId(metaAnalysis?.id, canLoadJobs);

    const latestResultId = getLatestMetaAnalysisResultId(metaAnalysis);
    const {
        data: latestMetaAnalysisResult,
        isLoading: latestResultIsLoading,
        isError: latestResultIsError,
    } = useGetMetaAnalysisResultById(latestResultId);

    const jobs = metaAnalysisJobs ?? [];
    const latestJob = jobs.length > 0 ? jobs[jobs.length - 1] : undefined;
    const {
        data: latestMetaAnalysisJob,
        isLoading: latestJobIsLoading,
        isError: latestJobIsError,
    } = useGetMetaAnalysisJobById(latestJob?.job_id);

    const resultStatus = useMemo(() => {
        return getResultStatus(metaAnalysis, latestMetaAnalysisResult, latestMetaAnalysisJob);
    }, [metaAnalysis, latestMetaAnalysisResult, latestMetaAnalysisJob]);

    const statusIsUnavailable =
        (canLoadJobs && (metaAnalysisJobsIsLoading || metaAnalysisJobsIsError)) ||
        latestResultIsLoading ||
        latestResultIsError ||
        latestJobIsLoading ||
        latestJobIsError;

    if (statusIsUnavailable) {
        return null;
    }

    return (
        <Tooltip title={resultStatus.description ?? ''} disableHoverListener={!resultStatus.description}>
            <Chip
                variant="outlined"
                size="small"
                color={resultStatus.color}
                label={resultStatus.statusText}
                icon={resultStatus.status === 'RUNNING' ? <CircularProgress size={16} color="inherit" /> : undefined}
            />
        </Tooltip>
    );
};

export default MetaAnalysisStatusChip;

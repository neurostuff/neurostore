import { Alert, CircularProgress, Typography } from '@mui/material';
import { getResultStatus } from 'helpers/MetaAnalysis.helpers';
import { useGetMetaAnalysisResultById } from 'hooks';
import { MetaAnalysisJobResponse, MetaAnalysisReturn, ResultReturn } from 'neurosynth-compose-typescript-sdk';
import { useEffect, useMemo, useState } from 'react';
import useGetMetaAnalysisJobById from '../hooks/useGetMetaAnalysisJobById';

export const localStorageResultAlertKey = 'hide-meta-analysis-result-alert';

const MetaAnalysisResultStatusAlert: React.FC<{
    metaAnalysis?: MetaAnalysisReturn;
    metaAnalysisJobs?: Array<MetaAnalysisJobResponse>;
}> = ({ metaAnalysis, metaAnalysisJobs }) => {
    const results = (metaAnalysis?.results ?? []) as ResultReturn[];
    const latestResult = results.length > 0 ? results[results.length - 1] : undefined;
    const {
        data: latestMetaAnalysisResult,
        isLoading: latestResultIsLoading,
        isError: latestResultIsError,
    } = useGetMetaAnalysisResultById(latestResult?.id);

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

    const [hideAlert, setHideAlert] = useState<boolean>(false);

    useEffect(() => {
        if (!resultStatus || !metaAnalysis?.id) return;
        const shouldHide = !!localStorage.getItem(`${localStorageResultAlertKey}-${metaAnalysis?.id}`);
        setHideAlert(shouldHide);
    }, [metaAnalysis?.id, resultStatus]);

    if (
        hideAlert === undefined ||
        latestResultIsLoading ||
        latestResultIsError ||
        latestJobIsLoading ||
        latestJobIsError
    )
        return null;

    return (
        <>
            {!hideAlert && (
                <Alert
                    icon={resultStatus.status === 'RUNNING' ? <CircularProgress size={20} /> : undefined}
                    severity={resultStatus.severity}
                    color={resultStatus.color}
                    onClose={() => {
                        setHideAlert(true);
                        localStorage.setItem(`${localStorageResultAlertKey}-${metaAnalysis?.id}`, 'true');
                    }}
                >
                    <Typography variant="h6">{resultStatus.statusText}</Typography>
                    {resultStatus.description && <Typography variant="body2">{resultStatus.description}</Typography>}
                </Alert>
            )}
        </>
    );
};

export default MetaAnalysisResultStatusAlert;

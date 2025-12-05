import { Box } from '@mui/material';
import CodeSnippet from 'components/CodeSnippet/CodeSnippet';
import { useEffect } from 'react';
import useGetMetaAnalysisJobById from '../hooks/useGetMetaAnalysisJobById';
import { MetaAnalysisJobResponse } from 'neurosynth-compose-typescript-sdk';
import { useQueryClient } from 'react-query';

const MetaAnalysisJob: React.FC<{
    metaAnalysisJobData?: MetaAnalysisJobResponse;
}> = ({ metaAnalysisJobData }) => {
    const { refetch } = useGetMetaAnalysisJobById(metaAnalysisJobData?.job_id);
    const queryClient = useQueryClient();

    useEffect(() => {
        if (metaAnalysisJobData?.status === 'SUCCEEDED' || metaAnalysisJobData?.status === 'FAILED') {
            // run is complete.
            // invalidate meta-analyses to refresh and retrieve the latest meta-analysis results
            queryClient.invalidateQueries('meta-analyses');
            return;
        }

        const timeout = setInterval(() => {
            // refetch the useGetMetaAnalysisJobById query to get the latest job status here as well as any outside useGetMetaAnalysisJobById() hook
            refetch();
        }, 10000);

        return () => {
            clearInterval(timeout);
        };
    }, [refetch, metaAnalysisJobData?.status, queryClient]);

    const logs = metaAnalysisJobData?.logs ?? [];

    return (
        <Box>
            <CodeSnippet
                title="Logs"
                linesOfCode={[...logs.map((log) => `${log.timestamp}: ${log.message}`), 'Running...']}
            />
        </Box>
    );
};

export default MetaAnalysisJob;

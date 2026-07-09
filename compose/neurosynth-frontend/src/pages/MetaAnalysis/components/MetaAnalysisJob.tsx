import { ExpandMoreOutlined } from '@mui/icons-material';
import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from '@mui/material';
import CodeSnippet from 'components/CodeSnippet/CodeSnippet';
import { MetaAnalysisJobResponse } from 'neurosynth-compose-typescript-sdk';
import { useEffect } from 'react';
import { useQueryClient } from 'react-query';
import useGetMetaAnalysisJobById from '../hooks/useGetMetaAnalysisJobById';

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

    const startTime = metaAnalysisJobData?.start_time
        ? new Date(metaAnalysisJobData.start_time.toString()).toDateString()
        : 'No Start Date Available';

    return (
        <Box>
            <Accordion elevation={1} defaultExpanded={false}>
                <AccordionSummary
                    sx={{
                        ':hover': {
                            backgroundColor: '#f2f2f2',
                            transition: '200ms ease-in-out',
                        },
                    }}
                    expandIcon={<ExpandMoreOutlined />}
                    aria-controls="panel1-content"
                    id="panel1-header"
                >
                    <Typography component="span">Click to view logs</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ padding: '1rem' }}>
                    <CodeSnippet
                        title={startTime}
                        linesOfCode={[...logs.map((log) => `${log.timestamp}: ${log.message}`), 'Running...']}
                    />
                </AccordionDetails>
            </Accordion>
        </Box>
    );
};

export default MetaAnalysisJob;

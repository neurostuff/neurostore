import { OpenInNew } from '@mui/icons-material';
import { Button, Card, CardActions, CardContent, CardHeader, Link, Typography } from '@mui/material';
import { Box } from '@mui/system';
import CodeSnippet from 'components/CodeSnippet/CodeSnippet';
import useSubmitMetaAnalysisJob from '../hooks/useSubmitMetaAnalysisJob';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import { useState } from 'react';
import { useSnackbar } from 'notistack';
import { localStorageStatusAlertKey } from './MetaAnalysisStatusAlert';

const MetaAnalysisInstructions: React.FC<{
    metaAnalysisId: string;
    onSubmitMetaAnalysisJob?: () => void;
}> = ({ metaAnalysisId, onSubmitMetaAnalysisJob = () => {} }) => {
    const { mutate: submitMetaAnalysisJob, isLoading: submitMetaAnalysisJobIsLoading } = useSubmitMetaAnalysisJob();
    const { enqueueSnackbar } = useSnackbar();
    const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
    const handleCloseConfirmationDialog = (confirm: boolean | undefined) => {
        if (confirm) {
            submitMetaAnalysisJob(
                // we want everyone to upload results to neurostore/neurovault
                { meta_analysis_id: metaAnalysisId, no_upload: false },
                {
                    onSuccess: () => {
                        enqueueSnackbar('Meta-analysis job submitted successfully', { variant: 'success' });
                        setShowConfirmationDialog(false);
                        onSubmitMetaAnalysisJob();
                        // show the alert in case the user has previously hidden it as it contains important info about the job status.
                        // we show the alert by removing the item from the localStorage
                        if (localStorage.getItem(`${localStorageStatusAlertKey}-${metaAnalysisId}`)) {
                            localStorage.removeItem(`${localStorageStatusAlertKey}-${metaAnalysisId}`);
                        }
                    },
                }
            );
            return;
        } else {
            setShowConfirmationDialog(false);
        }
    };

    return (
        <Box sx={{ marginBottom: '4rem' }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }} my={3}>
                Run your meta-analysis via one of the following methods:
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 4 }}>
                <Card
                    elevation={2}
                    sx={{
                        padding: 1,
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    <ConfirmationDialog
                        isOpen={showConfirmationDialog}
                        confirmText="Run meta-analysis"
                        confirmButtonProps={{
                            isLoading: submitMetaAnalysisJobIsLoading,
                            loaderColor: 'secondary',
                        }}
                        rejectText="Cancel"
                        dialogTitle="You are about to run your meta-analysis online via AWS."
                        dialogMessage="Note: once you run and produce a result, you will not be able to delete this meta-analysis."
                        onCloseDialog={handleCloseConfirmationDialog}
                    />
                    <CardHeader
                        title="1. Online via Amazon Web Services"
                        titleTypographyProps={{
                            variant: 'h6',
                            fontWeight: 'bold',
                        }}
                    />
                    <CardContent sx={{ flexGrow: 1 }}>
                        <Typography variant="body1" gutterBottom>
                            You can run your meta-analysis online using Amazon Web Services.
                        </Typography>
                        <Typography variant="body1">
                            This method utilizes EC2 instances and/or AWS Lambda functions, and is the easiest way to
                            run your meta-analysis.
                        </Typography>
                    </CardContent>
                    <CardActions sx={{ padding: '0 1rem 1rem 1rem' }}>
                        <Button variant="contained" fullWidth onClick={() => setShowConfirmationDialog(true)}>
                            run meta-analysis
                        </Button>
                    </CardActions>
                </Card>
                <Card elevation={2} sx={{ padding: 1, display: 'flex', flexDirection: 'column' }}>
                    <CardHeader
                        title="2. Online via Google Colab Notebook"
                        titleTypographyProps={{
                            variant: 'h6',
                            fontWeight: 'bold',
                        }}
                    />
                    <CardContent sx={{ flexGrow: 1 }}>
                        <CodeSnippet linesOfCode={[`${metaAnalysisId}`]} />
                        <Typography variant="body1" mt={3}>
                            Copy the meta-analysis id below and then click the button to open google collab
                        </Typography>
                    </CardContent>
                    <CardActions sx={{ padding: '0 1rem 1rem 1rem' }}>
                        <Button
                            variant="contained"
                            component={Link}
                            target="_blank"
                            fullWidth
                            rel="noopener"
                            href="https://githubtocolab.com/neurostuff/neurosynth-compose-notebook/blob/main/run_and_explore.ipynb"
                        >
                            <OpenInNew sx={{ marginRight: '8px', fontSize: '18px' }} />
                            open google collab
                        </Button>
                    </CardActions>
                </Card>
                <Card elevation={2} sx={{ padding: 1, display: 'flex', flexDirection: 'column' }}>
                    <CardHeader
                        title="3. Locally via Docker"
                        titleTypographyProps={{
                            variant: 'h6',
                            fontWeight: 'bold',
                        }}
                    />
                    <CardContent sx={{ flexGrow: 1 }}>
                        <CodeSnippet
                            linesOfCode={[
                                `docker run ghcr.io/neurostuff/nsc-runner:latest ${metaAnalysisId} --n-cores 1`,
                            ]}
                        />
                        <Typography variant="body1" mt={3}>
                            Copy the docker command above to run this meta-analysis locally.
                        </Typography>
                    </CardContent>
                    <CardActions sx={{ padding: '0 1rem 1rem 1rem', flexGrow: 1 }}></CardActions>
                </Card>
            </Box>
        </Box>
    );
};

export default MetaAnalysisInstructions;

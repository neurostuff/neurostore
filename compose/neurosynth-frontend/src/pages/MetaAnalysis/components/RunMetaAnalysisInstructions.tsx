import { OpenInNew } from '@mui/icons-material';
import {
    Button,
    Card,
    CardActions,
    CardContent,
    CardHeader,
    Checkbox,
    FormControlLabel,
    Link,
    Typography,
} from '@mui/material';
import { Box } from '@mui/system';
import CodeSnippet from 'components/CodeSnippet/CodeSnippet';
import useSubmitMetaAnalysisJob from '../hooks/useSubmitMetaAnalysisJob';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import { useState } from 'react';
import { useSnackbar } from 'notistack';

const RunMetaAnalysisInstructions: React.FC<{ metaAnalysisId: string }> = ({ metaAnalysisId }) => {
    const { mutate: submitMetaAnalysisJob, isLoading: submitMetaAnalysisJobIsLoading } = useSubmitMetaAnalysisJob();
    const { enqueueSnackbar } = useSnackbar();
    const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
    const [uploadResults, setUploadResults] = useState(true);
    const handleCloseConfirmationDialog = (confirm: boolean | undefined) => {
        if (confirm) {
            submitMetaAnalysisJob(
                { meta_analysis_id: metaAnalysisId, no_upload: false },
                {
                    onSuccess: () => {
                        enqueueSnackbar('Meta-analysis job submitted successfully', { variant: 'success' });
                        setShowConfirmationDialog(false);
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
            <Box sx={{ display: 'flex', gap: 4 }}>
                <Card elevation={2} sx={{ padding: 1, display: 'flex', flexDirection: 'column', flex: '1 1 0' }}>
                    <ConfirmationDialog
                        isOpen={showConfirmationDialog}
                        confirmText="Run meta-analysis"
                        confirmButtonProps={{
                            isLoading: submitMetaAnalysisJobIsLoading,
                            loaderColor: 'secondary',
                        }}
                        rejectText="Cancel"
                        dialogTitle="You are about to run your meta-analysis online via AWS."
                        dialogMessage={
                            <Box>
                                <Typography variant="body1" gutterBottom>
                                    Keep the checkbox below checked to upload results to neurostore/neurovault, or
                                    uncheck it to skip uploading results.
                                </Typography>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={uploadResults}
                                            onChange={(e) => setUploadResults(e.target.checked)}
                                        />
                                    }
                                    label={
                                        uploadResults
                                            ? 'Neurosynth Compose will upload results to neurostore/neurovault.'
                                            : 'Neurosynth Compose will not upload results to neurostore/neurovault.'
                                    }
                                />
                            </Box>
                        }
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
                <Card elevation={2} sx={{ padding: 1, display: 'flex', flexDirection: 'column', flex: '1 1 0' }}>
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
                <Card elevation={2} sx={{ padding: 1, display: 'flex', flexDirection: 'column', flex: '1 1 0' }}>
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

export default RunMetaAnalysisInstructions;

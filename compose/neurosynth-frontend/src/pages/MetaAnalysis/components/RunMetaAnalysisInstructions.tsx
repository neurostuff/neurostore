import { Paper, Typography, Button, Link } from '@mui/material';
import { Box } from '@mui/system';
import CodeSnippet from 'components/CodeSnippet/CodeSnippet';
import MetaAnalysisPageStyles from '../MetaAnalysisPage.styles';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

const RunMetaAnalysisInstructions: React.FC<{ metaAnalysisId: string }> = ({ metaAnalysisId }) => {
    return (
        <Paper
            sx={{
                marginBottom: '1rem',
                padding: '1rem',
                backgroundColor: 'info.light',
            }}
        >
            <Box
                sx={{
                    margin: '0rem 0 1rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                }}
            >
                <Box sx={{ marginRight: '1rem' }}>
                    <ErrorOutlineIcon sx={{ fontSize: '2rem', color: 'white' }} />
                </Box>
                <Box>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'white' }}>
                        Run your meta-analysis via one of the following methods.
                    </Typography>
                </Box>
            </Box>

            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                }}
            >
                <Box
                    sx={[MetaAnalysisPageStyles.runMethodContainer, { marginRight: '0.5rem' }]}
                    data-tour="MetaAnalysisPage-2"
                >
                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: 'bold',
                            marginBottom: '1rem',
                        }}
                    >
                        Online via google colab
                    </Typography>
                    <Typography sx={{ marginBottom: '0.5rem' }}>
                        copy the meta-analysis id below and then click the button to open google collab
                    </Typography>
                    <Box>
                        <CodeSnippet linesOfCode={[`${metaAnalysisId}`]} />
                    </Box>
                    <Box>
                        <Button
                            sx={{ marginTop: '1rem' }}
                            variant="contained"
                            component={Link}
                            target="_blank"
                            rel="noopener"
                            href="https://githubtocolab.com/neurostuff/neurosynth-compose-notebook/blob/main/run_and_explore.ipynb"
                        >
                            open google collab
                        </Button>
                    </Box>
                </Box>
                <Box
                    sx={[MetaAnalysisPageStyles.runMethodContainer, { marginLeft: '0.5rem' }]}
                    data-tour="MetaAnalysisPage-3"
                >
                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: 'bold',
                            marginBottom: '1rem',
                        }}
                    >
                        Locally via docker
                    </Typography>
                    <Typography sx={{ marginBottom: '0.5rem' }}>
                        copy the docker command below to run this meta-analysis locally
                    </Typography>
                    <Box>
                        <CodeSnippet
                            linesOfCode={[
                                `docker run ghcr.io/neurostuff/nsc-runner:latest ${metaAnalysisId} --n-cores 1`,
                            ]}
                        />
                    </Box>
                </Box>
            </Box>
        </Paper>
    );
};

export default RunMetaAnalysisInstructions;

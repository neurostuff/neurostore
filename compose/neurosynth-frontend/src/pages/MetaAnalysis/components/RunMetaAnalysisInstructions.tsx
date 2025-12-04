import { OpenInNew } from '@mui/icons-material';
import { Button, Card, CardActions, CardContent, CardHeader, Link, Typography } from '@mui/material';
import { Box } from '@mui/system';
import CodeSnippet from 'components/CodeSnippet/CodeSnippet';

const RunMetaAnalysisInstructions: React.FC<{ metaAnalysisId: string }> = ({ metaAnalysisId }) => {
    return (
        <Box sx={{ marginBottom: '4rem' }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }} my={3}>
                Run your meta-analysis via one of the following methods:
            </Typography>
            <Box sx={{ display: 'flex', gap: 4 }}>
                <Card elevation={2} sx={{ padding: 1, display: 'flex', flexDirection: 'column', flex: '1 1 0' }}>
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
                        <Button variant="contained" fullWidth>
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

    // return (
    //     <Paper
    //         sx={{
    //             marginBottom: '1rem',
    //             padding: '1rem',
    //             backgroundColor: 'info.light',
    //         }}
    //     >
    //         <Box
    //             sx={{
    //                 margin: '0rem 0 1rem 1rem',
    //                 display: 'flex',
    //                 alignItems: 'center',
    //             }}
    //         >
    //             <Box sx={{ marginRight: '1rem' }}>
    //                 <ErrorOutlineIcon sx={{ fontSize: '2rem', color: 'white' }} />
    //             </Box>
    //             <Box>
    //                 <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'white' }}>
    //                     Run your meta-analysis via one of the following methods.
    //                 </Typography>
    //             </Box>
    //         </Box>

    //         <Box
    //             sx={{
    //                 display: 'flex',
    //                 justifyContent: 'space-between',
    //             }}
    //         >
    //             <Box
    //                 sx={[MetaAnalysisPageStyles.runMethodContainer, { marginRight: '0.5rem' }]}
    //                 data-tour="MetaAnalysisPage-2"
    //             >
    //                 <Typography
    //                     variant="h6"
    //                     sx={{
    //                         fontWeight: 'bold',
    //                         marginBottom: '1rem',
    //                     }}
    //                 >
    //                     Online via google colab
    //                 </Typography>
    //                 <Typography sx={{ marginBottom: '0.5rem' }}>
    //                     copy the meta-analysis id below and then click the button to open google collab
    //                 </Typography>
    //                 <Box>
    //                     <CodeSnippet linesOfCode={[`${metaAnalysisId}`]} />
    //                 </Box>
    //                 <Box>
    //                     <Button
    //                         sx={{ marginTop: '1rem' }}
    //                         variant="contained"
    //                         component={Link}
    //                         target="_blank"
    //                         rel="noopener"
    //                         href="https://githubtocolab.com/neurostuff/neurosynth-compose-notebook/blob/main/run_and_explore.ipynb"
    //                     >
    //                         open google collab
    //                     </Button>
    //                 </Box>
    //             </Box>
    //             <Box
    //                 sx={[MetaAnalysisPageStyles.runMethodContainer, { marginLeft: '0.5rem' }]}
    //                 data-tour="MetaAnalysisPage-3"
    //             >
    //                 <Typography
    //                     variant="h6"
    //                     sx={{
    //                         fontWeight: 'bold',
    //                         marginBottom: '1rem',
    //                     }}
    //                 >
    //                     Locally via docker
    //                 </Typography>
    //                 <Typography sx={{ marginBottom: '0.5rem' }}>
    //                     copy the docker command below to run this meta-analysis locally
    //                 </Typography>
    //                 <Box>
    //                     <CodeSnippet
    //                         linesOfCode={[
    //                             `docker run ghcr.io/neurostuff/nsc-runner:latest ${metaAnalysisId} --n-cores 1`,
    //                         ]}
    //                     />
    //                 </Box>
    //             </Box>
    //         </Box>
    //     </Paper>
    // );
};

export default RunMetaAnalysisInstructions;

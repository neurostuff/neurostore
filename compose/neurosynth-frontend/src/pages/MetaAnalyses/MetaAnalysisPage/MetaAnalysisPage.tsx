import { Box, Typography, Paper, Button, Link, IconButton } from '@mui/material';
import { useParams } from 'react-router-dom';
import TextEdit from 'components/TextEdit/TextEdit';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import CodeSnippet from 'components/CodeSnippet/CodeSnippet';
import { useGetMetaAnalysisById } from 'hooks';
import useUpdateMetaAnalysis from 'hooks/requests/useUpdateMetaAnalysis';
import {
    AnnotationReturn,
    SpecificationReturn,
    StudysetReturn,
} from 'neurosynth-compose-typescript-sdk';
import MetaAnalysisPageStyles from './MetaAnalysisPage.styles';
import Help from '@mui/icons-material/Help';
import useGetTour from 'hooks/useGetTour';
import { useSnackbar } from 'notistack';
import { useAuth0 } from '@auth0/auth0-react';

const MetaAnalysisPage: React.FC = (props) => {
    const { startTour } = useGetTour('MetaAnalysisPage');
    const { enqueueSnackbar } = useSnackbar();
    const { user } = useAuth0();
    const { metaAnalysisId }: { metaAnalysisId: string } = useParams();

    /**
     * We need to use two separate instances of the same hook so that it only shows
     * the name loading when we update the name, and only the description loading when
     * we update the description
     */
    const { mutate: updateMetaAnalysisName, isLoading: updateMetaAnalysisNameIsLoading } =
        useUpdateMetaAnalysis();

    const {
        mutate: updateMetaAnalysisDescription,
        isLoading: updateMetaAnalysisDescriptionIsLoading,
    } = useUpdateMetaAnalysis();

    const {
        data,
        isError: getMetaAnalysisIsError,
        isLoading: getMetaAnalysisIsLoading,
    } = useGetMetaAnalysisById(metaAnalysisId);

    // get request is set to nested: true so below casting is safe
    const specification = data?.specification as SpecificationReturn;
    const studyset = data?.studyset as StudysetReturn;
    const annotation = data?.annotation as AnnotationReturn;

    const thisUserOwnsThisMetaAnalysis = (data?.user || undefined) === (user?.sub || null);

    const updateName = (updatedName: string, _label: string) => {
        if (data?.id && specification?.id && studyset?.id && annotation?.id) {
            updateMetaAnalysisName(
                {
                    metaAnalysisId: data.id,
                    metaAnalysis: {
                        name: updatedName,
                    },
                },
                {
                    onError: () => {
                        enqueueSnackbar('There was an error updating the meta-analysis name', {
                            variant: 'error',
                        });
                    },
                }
            );
        }
    };

    const updateDescription = (updatedDescription: string, _label: string) => {
        if (data?.id && specification?.id && studyset?.id && annotation?.id) {
            updateMetaAnalysisDescription(
                {
                    metaAnalysisId: data.id,
                    metaAnalysis: {
                        description: updatedDescription,
                    },
                },
                {
                    onError: () => {
                        enqueueSnackbar(
                            'There was an error updating the meta-analysis description',
                            {
                                variant: 'error',
                            }
                        );
                    },
                }
            );
        }
    };

    return (
        <>
            <StateHandlerComponent
                isLoading={getMetaAnalysisIsLoading}
                isError={getMetaAnalysisIsError}
                errorMessage="There was an error getting your meta-analysis"
            >
                <Box sx={{ display: 'flex', marginBottom: '1rem' }}>
                    <Box sx={{ flexGrow: 1 }}>
                        <TextEdit
                            editIconIsVisible={thisUserOwnsThisMetaAnalysis}
                            isLoading={updateMetaAnalysisNameIsLoading}
                            onSave={updateName}
                            sx={{ fontSize: '1.5rem' }}
                            label="name"
                            textToEdit={data?.name || ''}
                        >
                            <Box sx={MetaAnalysisPageStyles.displayedText}>
                                <Typography
                                    sx={[
                                        MetaAnalysisPageStyles.displayedText,
                                        !data?.name ? MetaAnalysisPageStyles.noData : {},
                                    ]}
                                    variant="h5"
                                >
                                    {data?.name || 'No name'}
                                </Typography>
                            </Box>
                        </TextEdit>

                        <TextEdit
                            editIconIsVisible={thisUserOwnsThisMetaAnalysis}
                            isLoading={updateMetaAnalysisDescriptionIsLoading}
                            onSave={updateDescription}
                            label="description"
                            sx={{ fontSize: '1.25rem' }}
                            textToEdit={data?.description || ''}
                        >
                            <Box sx={MetaAnalysisPageStyles.displayedText}>
                                <Typography
                                    variant="h6"
                                    sx={[
                                        MetaAnalysisPageStyles.displayedText,
                                        MetaAnalysisPageStyles.description,
                                        !data?.description ? MetaAnalysisPageStyles.noData : {},
                                    ]}
                                >
                                    {data?.description || 'No description'}
                                </Typography>
                            </Box>
                        </TextEdit>
                    </Box>
                    <Box>
                        <IconButton onClick={() => startTour()}>
                            <Help color="primary" />
                        </IconButton>
                    </Box>
                </Box>
                <Box>
                    <Typography variant="h6" sx={{ marginBottom: '2rem' }}>
                        This meta-analysis has not been run yet. Run your meta-analysis using the
                        following method(s):
                    </Typography>

                    <Paper
                        data-tour="MetaAnalysisPage-1"
                        sx={{ padding: '1rem', marginBottom: '2rem' }}
                    >
                        <Typography sx={{ fontWeight: 'bold', marginBottom: '1rem' }}>
                            run your meta-analysis via google colab
                        </Typography>
                        <Typography sx={{ marginBottom: '0.5rem' }}>
                            copy the meta-analysis id below and then click the button to open google
                            collab
                        </Typography>
                        <CodeSnippet linesOfCode={[`${data?.id}`]} />
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
                    </Paper>

                    <Paper
                        data-tour="MetaAnalysisPage-2"
                        sx={{ padding: '1rem', marginBottom: '2rem' }}
                    >
                        <Typography sx={{ fontWeight: 'bold', marginBottom: '1rem' }}>
                            run your meta-analysis via docker
                        </Typography>
                        <Typography>
                            Click the "Help" button above to learn more about this in the
                            documentation
                        </Typography>
                        {/* <CodeSnippet
                        linesOfCode={[
                            'sudo bash exec ./some-file-name',
                            'sudo bash exec some-other-command',
                            'docker-compose up made-up-service',
                        ]}
                    /> */}
                    </Paper>

                    {/* <Paper sx={{ padding: '1rem', marginBottom: '1rem' }}>
                    <Typography sx={{ fontWeight: 'bold', marginBottom: '2rem' }}>
                        run your meta-analysis using NiMARE and your own environment
                    </Typography>
                    <CodeSnippet
                        linesOfCode={[
                            'python some sort of python command here',
                            'python more python commands',
                            'bash maybe mix in some bash commands?',
                        ]}
                    />
                </Paper> */}
                </Box>
            </StateHandlerComponent>
        </>
    );
};

export default MetaAnalysisPage;

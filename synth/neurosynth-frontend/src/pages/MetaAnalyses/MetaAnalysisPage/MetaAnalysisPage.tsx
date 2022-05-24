import { Box, Typography, Paper, Button, Link } from '@mui/material';
import { useParams } from 'react-router-dom';
import { CodeSnippet, StateHandlerComponent, TextEdit } from 'components';
import { useGetMetaAnalysisById } from 'hooks';
import useUpdateMetaAnalysis from 'hooks/requests/useUpdateMetaAnalysis';
import {
    AnnotationReturn,
    SpecificationReturn,
    StudysetReturn,
} from 'neurosynth-compose-typescript-sdk';
import MetaAnalysisPageStyles from './MetaAnalysisPage.styles';

const MetaAnalysisPage: React.FC = (props) => {
    const { metaAnalysisId }: { metaAnalysisId: string } = useParams();
    const {
        data,
        isError: getMetaAnalysisIsError,
        isLoading: getMetaAnalysisIsLoading,
    } = useGetMetaAnalysisById(metaAnalysisId);
    const { mutateAsync } = useUpdateMetaAnalysis();

    // get request is set to nested: true so below casting is safe
    const specification = data?.specification as SpecificationReturn;
    const studyset = data?.studyset as StudysetReturn;
    const annotation = data?.annotation as AnnotationReturn;

    const handleEditFields = (newValue: string, label: string) => {
        if (specification?.id && studyset?.id && annotation?.id) {
            return mutateAsync({
                metaAnalysisId: metaAnalysisId,
                metaAnalysis: {
                    specification: specification?.id,
                    internal_annotation_id: annotation?.id,
                    internal_studyset_id: studyset?.id,
                    [label]: newValue,
                },
            });
        }
    };

    return (
        <StateHandlerComponent
            isLoading={getMetaAnalysisIsLoading}
            isError={getMetaAnalysisIsError}
            errorMessage="There was an error getting your meta-analysis"
        >
            <Box sx={{ marginBottom: '1rem' }}>
                <TextEdit
                    onSave={handleEditFields}
                    sx={{ fontSize: '1.25rem' }}
                    label="name"
                    textToEdit={data?.name || ''}
                >
                    <Box sx={MetaAnalysisPageStyles.displayedText}>
                        <Typography
                            sx={[
                                MetaAnalysisPageStyles.displayedText,
                                !data?.name ? MetaAnalysisPageStyles.noData : {},
                            ]}
                            variant="h6"
                        >
                            {data?.name || 'No name'}
                        </Typography>
                    </Box>
                </TextEdit>

                <TextEdit
                    onSave={handleEditFields}
                    label="description"
                    textToEdit={data?.description || ''}
                >
                    <Box sx={MetaAnalysisPageStyles.displayedText}>
                        <Typography
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
                <Typography variant="h6" sx={{ marginBottom: '2rem' }}>
                    This meta-analysis has not been run yet. Run your meta-analysis using one of the
                    following methods:
                </Typography>

                <Paper sx={{ padding: '1rem', marginBottom: '2rem' }}>
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

                <Paper sx={{ padding: '1rem', marginBottom: '2rem' }}>
                    <Typography sx={{ fontWeight: 'bold', marginBottom: '1rem' }}>
                        run your meta-analysis via docker
                    </Typography>
                    <CodeSnippet
                        linesOfCode={[
                            'sudo bash exec ./some-file-name',
                            'sudo bash exec some-other-command',
                            'docker-compose up made-up-service',
                        ]}
                    />
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
    );
};

export default MetaAnalysisPage;

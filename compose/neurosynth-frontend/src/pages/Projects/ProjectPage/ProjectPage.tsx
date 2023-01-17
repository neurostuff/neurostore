import {
    Box,
    Typography,
    Stepper,
    ToggleButtonGroup,
    ToggleButton,
    Breadcrumbs,
    Link,
    Button,
    Step,
    StepLabel,
    StepContent,
} from '@mui/material';
import AlgorithmStep from 'components/ProjectStepComponents/AlgorithmStep/AlgorithmStep';
import CurationStep from 'components/ProjectStepComponents/CurationStep/CurationStep';
import ExtractionStep from 'components/ProjectStepComponents/ExtractionStep/ExtractionStep';
import FiltrationStep from 'components/ProjectStepComponents/FiltrationStep/FiltrationStep';
import ProjectStepComponentsStyles from 'components/ProjectStepComponents/ProjectStepComponents.styles';
import RunMetaAnalysisStep from 'components/ProjectStepComponents/RunMetaAnalysisStep/RunMetaAnalysisStep';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import TextEdit from 'components/TextEdit/TextEdit';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import useUpdateProject from 'hooks/requests/useUpdateProject';
import useGetCurationSummary from 'hooks/useGetCurationSummary';
import useGetExtractionSummary from 'hooks/useGetExtractionSummary';
import { useSnackbar } from 'notistack';
import { useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import ProjectPageStyles from './ProjectPage.styles';

const ProjectPage: React.FC = (props) => {
    const { projectId }: { projectId: string } = useParams();
    const { enqueueSnackbar } = useSnackbar();
    const { mutate: updateProjectName, isLoading: updateProjectNameIsLoading } = useUpdateProject();
    const { mutate: updateProjectDescription, isLoading: updateProjectDescriptionIsLoading } =
        useUpdateProject();
    const {
        data: project,
        isError: getProjectIsError,
        isLoading: getProjectIsLoading,
    } = useGetProjectById(projectId);
    const curationSummary = useGetCurationSummary(projectId);
    const extractionSummary = useGetExtractionSummary(projectId);

    const [tab, setTab] = useState(0);

    // TODO: for now, we will only be supporting a single meta-analysis, so we only assume there is one. This will change later.
    // const metaAnalysisId = (project?.meta_analyses as MetaAnalysis[]).

    // variables related to curation
    const curationStepMetadata = project?.provenance?.curationMetadata;

    // variables related to extraction
    const disableExtractionStep =
        curationSummary.total === 0 ||
        curationSummary.included === 0 ||
        curationSummary.uncategorized > 0;
    const extractionStepMetadata = project?.provenance?.extractionMetadata;

    const disableFiltrationStep =
        extractionSummary?.total === 0 || extractionSummary.total !== extractionSummary.completed;

    const filtrationMetadata = project?.provenance?.filtrationMetadata;
    const algorithmMetadata = project?.provenance?.algorithmMetadata;

    const disableRunMetaAnalysisStep = !project?.provenance?.algorithmMetadata?.specificationId;

    const handleTabChange = (event: any, tab: number) => {
        setTab((prev) => {
            if (tab === null) return prev;
            return tab;
        });
    };

    const activeStep = +!!extractionStepMetadata + +!!filtrationMetadata + +!!algorithmMetadata;

    return (
        <StateHandlerComponent isLoading={getProjectIsLoading} isError={getProjectIsError}>
            <Breadcrumbs sx={{ marginBottom: '0.5rem' }}>
                <Link
                    component={NavLink}
                    to="/projects"
                    sx={{ cursor: 'pointer', fontSize: '1.5rem' }}
                    underline="hover"
                >
                    Projects
                </Link>
                <Typography sx={{ fontSize: '1.5rem' }} color="secondary">
                    {project?.name || ''}
                </Typography>
            </Breadcrumbs>

            <Box sx={{ marginBottom: '0.5rem' }}>
                <TextEdit
                    onSave={(updatedName, label) =>
                        updateProjectName(
                            { projectId, project: { name: updatedName } },
                            {
                                onSuccess: () => {
                                    enqueueSnackbar('Project updated successfully', {
                                        variant: 'success',
                                    });
                                },
                            }
                        )
                    }
                    sx={{ input: { fontSize: '2rem' }, width: '50%' }}
                    isLoading={updateProjectNameIsLoading}
                    textToEdit={project?.name || ''}
                >
                    <Typography
                        sx={{ color: project?.name ? 'initial' : 'warning.dark' }}
                        variant="h4"
                    >
                        {project?.name || 'No name'}
                    </Typography>
                </TextEdit>
                <TextEdit
                    onSave={(updatedDescription, label) =>
                        updateProjectDescription(
                            {
                                projectId,
                                project: { description: updatedDescription },
                            },
                            {
                                onSuccess: () => {
                                    enqueueSnackbar('Project updated successfully', {
                                        variant: 'success',
                                    });
                                },
                            }
                        )
                    }
                    sx={{ input: { fontSize: '1.25rem' }, width: '50%' }}
                    isLoading={updateProjectDescriptionIsLoading}
                    textToEdit={project?.description || ''}
                >
                    <Typography
                        sx={{ color: project?.description ? 'initial' : 'warning.dark' }}
                        variant="h6"
                    >
                        {project?.description || 'No description'}
                    </Typography>
                </TextEdit>
            </Box>

            <ToggleButtonGroup
                sx={{ marginBottom: '1.5rem', marginTop: '1rem' }}
                color="primary"
                value={tab}
                exclusive
                size="medium"
                onChange={handleTabChange}
            >
                <ToggleButton onClick={() => setTab(0)} color="primary" value={0}>
                    Build Meta-Analysis
                </ToggleButton>
                <ToggleButton sx={{ display: algorithmMetadata ? 'initial' : 'none' }} value={1}>
                    View Meta-Analysis
                </ToggleButton>
            </ToggleButtonGroup>

            {tab === 0 && (
                <Stepper
                    activeStep={activeStep}
                    orientation="vertical"
                    sx={[ProjectPageStyles.stepper, { display: tab === 0 ? 'initial' : 'none' }]}
                >
                    <CurationStep hasCurationMetadata={!!curationStepMetadata} />
                    <ExtractionStep
                        disabled={disableExtractionStep}
                        extractionMetadata={extractionStepMetadata}
                    />
                    <FiltrationStep
                        filtrationMetadata={filtrationMetadata}
                        disabled={disableFiltrationStep}
                    />
                    <AlgorithmStep
                        algorithmMetadata={algorithmMetadata}
                        disabled={!filtrationMetadata?.filter}
                    />
                    <RunMetaAnalysisStep disabled={disableRunMetaAnalysisStep} />
                </Stepper>
            )}
            {tab === 1 && <div>view meta-analysis</div>}
            <Button
                onClick={() => {
                    updateProjectName({ projectId, project: { provenance: {} } });
                }}
                sx={{ marginTop: '1rem' }}
                variant="contained"
                color="error"
            >
                Clear Provenance (FOR DEV PURPOSES ONLY)
            </Button>
        </StateHandlerComponent>
    );
};

export default ProjectPage;

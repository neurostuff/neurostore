import {
    Box,
    Typography,
    Stepper,
    ToggleButtonGroup,
    ToggleButton,
    Breadcrumbs,
    Link,
    Button,
} from '@mui/material';
import AlgorithmStep from 'components/ProjectStepComponents/AlgorithmStep/AlgorithmStep';
import CurationStep from 'components/ProjectStepComponents/CurationStep/CurationStep';
import ExtractionStep from 'components/ProjectStepComponents/ExtractionStep/ExtractionStep';
import FiltrationStep from 'components/ProjectStepComponents/FiltrationStep/FiltrationStep';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import TextEdit from 'components/TextEdit/TextEdit';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import useUpdateProject from 'hooks/requests/useUpdateProject';
import useGetCurationSummary from 'hooks/useGetCurationSummary';
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

    const filtrationStep = undefined;
    const metaAnalysisStep = false;

    const handleTabChange = (event: any, tab: number) => {
        setTab((prev) => {
            if (tab === null) return prev;
            return tab;
        });
    };

    const activeStep = +!!extractionStepMetadata + +!!filtrationStep;

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
                    <Typography variant="h4">{project?.name || ''}</Typography>
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
                    <Typography variant="h6">{project?.description || ''}</Typography>
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
                <ToggleButton sx={{ display: metaAnalysisStep ? 'initial' : 'none' }} value={1}>
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
                    <FiltrationStep filter={filtrationStep} disabled={!extractionStepMetadata} />
                    <AlgorithmStep specification={undefined} disabled={!filtrationStep} />
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

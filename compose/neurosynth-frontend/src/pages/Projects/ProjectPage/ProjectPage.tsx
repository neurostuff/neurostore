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
import {
    useClearProvenance,
    useInitProjectStore,
    useProjectAlgorithmMetadata,
    useProjectCurationColumns,
    useProjectDescription,
    useProjectExtractionMetadata,
    useProjectFiltrationMetadata,
    useProjectName,
    useUpdateProjectDescription,
    useUpdateProjectName,
} from 'pages/Projects/ProjectPage/ProjectStore';
import AlgorithmStep from 'components/ProjectStepComponents/AlgorithmStep/AlgorithmStep';
import CurationStep from 'components/ProjectStepComponents/CurationStep/CurationStep';
import ExtractionStep from 'components/ProjectStepComponents/ExtractionStep/ExtractionStep';
import FiltrationStep from 'components/ProjectStepComponents/FiltrationStep/FiltrationStep';
import RunMetaAnalysisStep from 'components/ProjectStepComponents/RunMetaAnalysisStep/RunMetaAnalysisStep';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import TextEdit from 'components/TextEdit/TextEdit';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import useGetCurationSummary from 'hooks/useGetCurationSummary';
import useGetExtractionSummary from 'hooks/useGetExtractionSummary';
import { useEffect, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import ProjectPageStyles from './ProjectPage.styles';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs/NeurosynthBreadcrumbs';

export interface IProjectPageLocationState {
    projectPage?: {
        openCurationDialog?: boolean;
    };
}

// TODO: for now, we will only be supporting a single meta-analysis, so we only assume there is one. This will change later.
// const metaAnalysisId = (project?.meta_analyses as MetaAnalysis[]).
const ProjectPage: React.FC = (props) => {
    const { projectId }: { projectId: string } = useParams();
    const {
        data: project,
        isError: getProjectIsError,
        isLoading: getProjectIsLoading,
    } = useGetProjectById(projectId);
    const curationSummary = useGetCurationSummary();
    const extractionSummary = useGetExtractionSummary(projectId);
    const [tab, setTab] = useState(0);

    const updateProjectName = useUpdateProjectName();
    const updateProjectDescription = useUpdateProjectDescription();
    const initProjectStore = useInitProjectStore();
    const clearProvenance = useClearProvenance();

    const projectName = useProjectName();
    const projectDescription = useProjectDescription();

    const curationStepHasBeenInitialized = useProjectCurationColumns().length > 0;

    const extractionMetadata = useProjectExtractionMetadata();
    const extractionStepHasBeenInitialized =
        !!extractionMetadata.annotationId && !!extractionMetadata.studysetId;

    const disableExtractionStep =
        curationSummary.total === 0 ||
        curationSummary.included === 0 ||
        curationSummary.uncategorized > 0;

    const filtrationMetadata = useProjectFiltrationMetadata();
    const filtrationStepHasBeenInitialized = !!filtrationMetadata.filter.filtrationKey;

    const disableFiltrationStep =
        extractionSummary?.total === 0 || extractionSummary.total !== extractionSummary.completed;

    // variables realted to algorithm
    const algorithmMetadata = useProjectAlgorithmMetadata();
    const algorithmStepHasBeenInitialized = !!algorithmMetadata.specificationId;
    const disableRunMetaAnalysisStep = !algorithmMetadata.specificationId;

    const activeStep =
        +!!extractionStepHasBeenInitialized +
        +!!filtrationStepHasBeenInitialized +
        +!!algorithmStepHasBeenInitialized;

    useEffect(() => {
        initProjectStore(projectId);
    }, [initProjectStore, projectId]);

    const handleTabChange = (event: any, tab: number) => {
        setTab((prev) => {
            if (tab === null) return prev;
            return tab;
        });
    };

    return (
        <StateHandlerComponent isLoading={getProjectIsLoading} isError={getProjectIsError}>
            <Box sx={{ marginBottom: '0.5rem' }}>
                <NeurosynthBreadcrumbs
                    breadcrumbItems={[
                        {
                            text: 'Projects',
                            link: '/projects',
                            isCurrentPage: false,
                        },
                        {
                            text: projectName || '',
                            link: '',
                            isCurrentPage: true,
                        },
                    ]}
                />
            </Box>

            <Box sx={{ marginBottom: '0.5rem' }}>
                <TextEdit
                    onSave={(updatedName, label) => updateProjectName(updatedName)}
                    sx={{ input: { fontSize: '2rem' }, width: '50%' }}
                    textToEdit={projectName || ''}
                >
                    <Typography
                        sx={{ color: projectName ? 'initial' : 'warning.dark' }}
                        variant="h4"
                    >
                        {projectName || 'No name'}
                    </Typography>
                </TextEdit>
                <TextEdit
                    onSave={(updatedDescription, label) =>
                        updateProjectDescription(updatedDescription)
                    }
                    sx={{ input: { fontSize: '1.25rem' }, width: '50%' }}
                    textToEdit={projectDescription || ''}
                >
                    <Typography
                        sx={{ color: projectDescription ? 'initial' : 'warning.dark' }}
                        variant="h6"
                    >
                        {projectDescription || 'No description'}
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
                <ToggleButton
                    sx={{ display: algorithmStepHasBeenInitialized ? 'initial' : 'none' }}
                    value={1}
                >
                    View Meta-Analysis
                </ToggleButton>
            </ToggleButtonGroup>

            {tab === 0 && (
                <Stepper
                    activeStep={activeStep}
                    orientation="vertical"
                    sx={[ProjectPageStyles.stepper, { display: tab === 0 ? 'initial' : 'none' }]}
                >
                    <CurationStep curationStepHasBeenInitialized={curationStepHasBeenInitialized} />
                    <ExtractionStep
                        extractionStepHasBeenInitialized={extractionStepHasBeenInitialized}
                        disabled={disableExtractionStep}
                    />
                    <FiltrationStep
                        filtrationStepHasBeenInitialized={filtrationStepHasBeenInitialized}
                        disabled={disableFiltrationStep}
                    />
                    <AlgorithmStep
                        algorithmStepHasBeenInitialized={algorithmStepHasBeenInitialized}
                        disabled={true}
                    />
                    <RunMetaAnalysisStep disabled={disableRunMetaAnalysisStep} />
                </Stepper>
            )}
            {tab === 1 && <div>view meta-analysis</div>}
            <Button
                onClick={() => {
                    clearProvenance();
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

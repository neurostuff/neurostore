import {
    Box,
    Tab,
    Tabs,
    Typography,
    Stepper,
    ToggleButtonGroup,
    ToggleButton,
    Breadcrumbs,
    Link,
} from '@mui/material';
import AlgorithmStep from 'components/ProjectStepComponents/AlgorithmStep/AlgorithmStep';
import CurationStep from 'components/ProjectStepComponents/CurationStep/CurationStep';
import ExtractionStep from 'components/ProjectStepComponents/ExtractionStep/ExtractionStep';
import FiltrationStep from 'components/ProjectStepComponents/FiltrationStep/FiltrationStep';
import TextEdit from 'components/TextEdit/TextEdit';
import { useGetMetaAnalysisById } from 'hooks';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import { Specification } from 'neurosynth-compose-typescript-sdk';
import { useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import ProjectPageStyles from './ProjectPage.styles';

const ProjectPage: React.FC = (props) => {
    const { projectId }: { projectId: string } = useParams();
    const {
        data: project,
        isError: getProjectIsError,
        isLoading: getProjectIsLoading,
    } = useGetProjectById(projectId);
    const {
        data: metaAnalysis,
        isError: getMetaAnalysisIsError,
        isLoading: getMetaAnalysisIsLoading,
    } = useGetMetaAnalysisById(project?.metaAnalysisId || undefined);

    const curationStep = (project?.provenance || {}).curationMetadata;
    const extractionStep = (project?.provenance || {}).extractionMetadata;
    const filtrationStep = !!(metaAnalysis?.specification as Specification)?.filter;
    const metaAnalysisStep = false;

    const [tab, setTab] = useState(0);

    const handleTabChange = (event: any, tab: number) => {
        setTab((prev) => {
            if (tab === null) return prev;
            return tab;
        });
    };

    const activeStep = +!!curationStep + +!!extractionStep + +!!filtrationStep;

    return (
        <Box sx={{ marginBottom: '4rem' }}>
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
                    onSave={() => {}}
                    sx={{ fontSize: '2rem' }}
                    textToEdit={project?.name || ''}
                >
                    <Typography variant="h4">{project?.name || ''}</Typography>
                </TextEdit>
                <TextEdit
                    onSave={() => {}}
                    sx={{ fontSize: '1rem' }}
                    textToEdit={project?.description || ''}
                >
                    <Typography variant="body1">{project?.description || ''}</Typography>
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
                    <CurationStep curationMetadata={project?.provenance?.curationMetadata} />
                    <ExtractionStep
                        disabled={!project?.provenance?.curationMetadata}
                        extractionMetadata={project?.provenance?.extractionMetadata}
                    />
                    <FiltrationStep
                        filter={(metaAnalysis?.specification as Specification)?.filter || undefined}
                        disabled={!project?.provenance?.extractionMetadata}
                    />
                    <AlgorithmStep
                        specification={(metaAnalysis?.specification as Specification) || undefined}
                        disabled={!(metaAnalysis?.specification as Specification)?.filter}
                    />
                </Stepper>
            )}
            {tab === 1 && <div>view meta-analysis</div>}
        </Box>
    );
};

export default ProjectPage;

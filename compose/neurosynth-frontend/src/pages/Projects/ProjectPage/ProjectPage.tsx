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
import { ICurationColumn } from 'components/CurationComponents/CurationColumn/CurationColumn';
import AlgorithmStep from 'components/ProjectStepComponents/AlgorithmStep/AlgorithmStep';
import CurationStep from 'components/ProjectStepComponents/CurationStep/CurationStep';
import ExtractionStep from 'components/ProjectStepComponents/ExtractionStep/ExtractionStep';
import FiltrationStep from 'components/ProjectStepComponents/FiltrationStep/FiltrationStep';
import TextEdit from 'components/TextEdit/TextEdit';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import useUpdateProject from 'hooks/requests/useUpdateProject';
import { useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import ProjectPageStyles from './ProjectPage.styles';

const ProjectPage: React.FC = (props) => {
    const { projectId }: { projectId: string } = useParams();

    const { mutate: updateProjectName, isLoading: updateProjectNameIsLoading } = useUpdateProject();
    const { mutate: updateProjectDescription, isLoading: updateProjectDescriptionIsLoading } =
        useUpdateProject();

    const {
        data: project,
        isError: getProjectIsError,
        isLoading: getProjectIsLoading,
    } = useGetProjectById(projectId);

    const getNumUncategorizedStudies = (cols: ICurationColumn[]) => {
        if (cols.length <= 1) {
            // only one column, so automatically count this as inclusion colunn
            return 0;
        } else {
            const numUncategorizedStudiesInCols = cols.reduce((acc, col) => {
                const numStudiesWithouteExtraction = col.stubStudies.filter(
                    (x) => !x.exclusionTag
                ).length;
                return acc + numStudiesWithouteExtraction;
            }, 0);
            return numUncategorizedStudiesInCols;
        }
    };

    // TODO: for now, we will only be supporting a single meta-analysis, so we only assume there is one. This will change later.
    // const metaAnalysisId = (project?.meta_analyses as MetaAnalysis[]).

    // const { data: metaAnalysis } = useGetMetaAnalysisById(project?.meta_analyses);

    // variables related to curation
    const curationStepMetadata = project?.provenance?.curationMetadata;
    const numUncategorizedStudies = getNumUncategorizedStudies(curationStepMetadata?.columns || []);
    const numTotalStudies = (curationStepMetadata?.columns || []).reduce(
        (acc, curr) => acc + curr.stubStudies.length,
        0
    );

    const disableExtractionStep = numTotalStudies === 0 || numUncategorizedStudies > 0;

    // variables related to extraction
    const extractionStepMetadata = project?.provenance?.extractionMetadata;

    const filtrationStep = undefined;
    const metaAnalysisStep = false;

    const [tab, setTab] = useState(0);

    const handleTabChange = (event: any, tab: number) => {
        setTab((prev) => {
            if (tab === null) return prev;
            return tab;
        });
    };

    const activeStep = +!!extractionStepMetadata + +!!filtrationStep;

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
                    onSave={(updatedName, label) =>
                        updateProjectName({ projectId, project: { name: updatedName } })
                    }
                    sx={{ fontSize: '2rem' }}
                    isLoading={updateProjectNameIsLoading}
                    textToEdit={project?.name || ''}
                >
                    <Typography variant="h4">{project?.name || ''}</Typography>
                </TextEdit>
                <TextEdit
                    onSave={(updatedDescription, label) =>
                        updateProjectDescription({
                            projectId,
                            project: { description: updatedDescription },
                        })
                    }
                    sx={{ fontSize: '1rem' }}
                    isLoading={updateProjectDescriptionIsLoading}
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
                    <CurationStep curationMetadata={curationStepMetadata} />
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
        </Box>
    );
};

export default ProjectPage;

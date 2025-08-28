import { Stepper } from '@mui/material';
import { useGetStudysetById, useGetCurationSummary } from 'hooks';
import useGetExtractionSummary from 'hooks/useGetExtractionSummary';
import ProjectPageStyles from 'pages/Project/ProjectPage.styles';
import {
    useProjectCurationColumns,
    useProjectExtractionMetadata,
    useProjectUser,
} from 'pages/Project/store/ProjectStore';
import { useParams } from 'react-router-dom';
import DangerZone from 'pages/Project/components/ProjectDangerZone';
import useUserCanEdit from 'hooks/useUserCanEdit';
import ProjectCurationStep from 'pages/Project/components/ProjectCurationStep';
import ProjectExtractionStep from 'pages/Project/components/ProjectExtractionStep';
import ProjectSpecificationStep from 'pages/Project/components/ProjectSpecificationStep';

const ProjectEditMetaAnalyses: React.FC = (props) => {
    const projectUser = useProjectUser();
    const canEdit = useUserCanEdit(projectUser || undefined);
    const { projectId } = useParams<{ projectId: string }>();
    const extractionMetadata = useProjectExtractionMetadata();
    const { data: studyset } = useGetStudysetById(extractionMetadata?.studysetId || '');

    const curationStepHasBeenInitialized = useProjectCurationColumns().length > 0;

    const extractionStepHasBeenInitialized =
        !!extractionMetadata.annotationId && !!extractionMetadata.studysetId && (studyset?.studies?.length || 0) > 0;

    const { total, included, uncategorized } = useGetCurationSummary();
    const disableExtractionStep =
        (total === 0 || included === 0 || uncategorized > 0) && !extractionStepHasBeenInitialized;

    const extractionSummary = useGetExtractionSummary(projectId);
    const disableSpecificationStep =
        extractionSummary?.total === 0 || extractionSummary.total !== extractionSummary.completed;

    // activeStep is 0 indexed.
    const activeStep = +!disableExtractionStep + +!disableSpecificationStep;

    return (
        <Stepper activeStep={activeStep} orientation="vertical" sx={[ProjectPageStyles.stepper]}>
            <ProjectCurationStep disabled={!canEdit} curationStepHasBeenInitialized={curationStepHasBeenInitialized} />
            <ProjectExtractionStep
                extractionStepHasBeenInitialized={extractionStepHasBeenInitialized}
                disabled={!canEdit || disableExtractionStep}
            />
            <ProjectSpecificationStep disabled={!canEdit || disableSpecificationStep} />
            <DangerZone />
        </Stepper>
    );
};

export default ProjectEditMetaAnalyses;

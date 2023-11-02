import { Box, Button, Stepper } from '@mui/material';
import CurationStep from 'components/ProjectComponents/EditMetaAnalyses/CurationStep/CurationStep';
import ExtractionStep from 'components/ProjectComponents/EditMetaAnalyses/ExtractionStep/ExtractionStep';
import SpecificationStep from 'components/ProjectComponents/EditMetaAnalyses/SpecificationStep/SpecificationStep';
import useGetCurationSummary from 'hooks/useGetCurationSummary';
import useGetExtractionSummary from 'hooks/useGetExtractionSummary';
import ProjectPageStyles from 'pages/Projects/ProjectPage/ProjectPage.styles';
import {
    useProjectCurationColumns,
    useProjectExtractionMetadata,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { useParams } from 'react-router-dom';
import { useClearProvenance } from 'pages/Projects/ProjectPage/ProjectStore';
import { useGetStudysetById } from 'hooks';

const env = process.env.REACT_APP_ENV as 'DEV' | 'STAGING' | 'PROD';

const EditMetaAnalyses: React.FC = (props) => {
    const { projectId }: { projectId: string } = useParams();
    const extractionMetadata = useProjectExtractionMetadata();
    const { total, included, uncategorized } = useGetCurationSummary();
    const { data: studyset } = useGetStudysetById(extractionMetadata?.studysetId || '');
    const clearProvenance = useClearProvenance();

    const curationStepHasBeenInitialized = useProjectCurationColumns().length > 0;

    const extractionStepHasBeenInitialized =
        !!extractionMetadata.annotationId &&
        !!extractionMetadata.studysetId &&
        (studyset?.studies?.length || 0) > 0;

    const disableExtractionStep =
        (total === 0 || included === 0 || uncategorized > 0) && !extractionStepHasBeenInitialized;

    const extractionSummary = useGetExtractionSummary(projectId);
    const disableSpecificationStep =
        extractionSummary?.total === 0 || extractionSummary.total !== extractionSummary.completed;

    // activeStep is 0 indexed.
    const activeStep = +!disableExtractionStep + +!disableSpecificationStep;

    return (
        <Stepper activeStep={activeStep} orientation="vertical" sx={[ProjectPageStyles.stepper]}>
            <CurationStep curationStepHasBeenInitialized={curationStepHasBeenInitialized} />
            <ExtractionStep
                extractionStepHasBeenInitialized={extractionStepHasBeenInitialized}
                disabled={disableExtractionStep}
            />
            <SpecificationStep disabled={disableSpecificationStep} />
            {(env === 'DEV' || env === 'STAGING') && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                        onClick={() => clearProvenance()}
                        variant="text"
                        sx={{ marginTop: '2rem', marginLeft: '4.5rem' }}
                        color="error"
                    >
                        clear this project (ONLY FOR DEV PURPOSES, IRREVERSIBLE)
                    </Button>
                </Box>
            )}
        </Stepper>
    );
};

export default EditMetaAnalyses;

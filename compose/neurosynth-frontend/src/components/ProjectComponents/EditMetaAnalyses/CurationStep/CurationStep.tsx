import { Box, Step, StepContent, StepLabel, StepProps, Typography } from '@mui/material';
import { useInitCuration } from 'pages/Projects/ProjectPage/ProjectStore';
import { useNavigate, useParams } from 'react-router-dom';
import ProjectComponentsStyles from '../../ProjectComponents.styles';
import CurationStepCard from './CurationStepCard';
import CurationStepChooseWorkflow from './CurationStepChooseWorkflow';

export enum ECurationBoardTypes {
    PRISMA,
    SIMPLE,
    // CUSTOM,
    // SKIP,
}

interface ICurationStep {
    curationStepHasBeenInitialized: boolean;
    disabled: boolean;
}

const CurationStep: React.FC<ICurationStep & StepProps> = (props) => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const { curationStepHasBeenInitialized, disabled, ...stepProps } = props;

    const initCuration = useInitCuration();

    const handleCreateCuration = (curationBoardInitColumns: string[], isPRISMA: boolean) => {
        if (!projectId) return;

        initCuration(curationBoardInitColumns, isPRISMA);
        navigate(`/projects/${projectId}/curation`);
    };

    return (
        <Step {...stepProps} expanded={true} sx={ProjectComponentsStyles.step}>
            <StepLabel>
                <Typography sx={{ color: disabled ? 'muted.main' : 'primary.main' }} variant="h6">
                    <b>Search & Curate</b>: Import, exclude, and include studies of interest
                </Typography>
            </StepLabel>
            <StepContent>
                <Box sx={{ marginLeft: '2rem' }}>
                    <Typography sx={{ color: 'muted.main' }}>
                        <b>The first step in creating a meta-analysis</b>
                    </Typography>
                    <Typography gutterBottom sx={{ color: 'muted.main' }}>
                        In this step, import studies from PubMed, tag studies, and either exclude or
                        include studies into your meta-analysis
                    </Typography>
                    <Box sx={{ marginTop: '1rem' }}>
                        {curationStepHasBeenInitialized ? (
                            <CurationStepCard disabled={disabled} projectId={projectId} />
                        ) : (
                            <CurationStepChooseWorkflow
                                disabled={disabled}
                                onCreateCuration={handleCreateCuration}
                            />
                        )}
                    </Box>
                </Box>
            </StepContent>
        </Step>
    );
};

export default CurationStep;

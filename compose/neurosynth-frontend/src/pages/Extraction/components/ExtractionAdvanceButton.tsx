import { PriorityHigh } from '@mui/icons-material';
import { Box, Button, ButtonProps, Typography } from '@mui/material';
import GlobalStyles from 'global.styles';
import { useGetExtractionSummary, useUserCanEdit } from 'hooks';
import { enqueueSnackbar } from 'notistack';
import { IProjectPageLocationState } from 'pages/Project/ProjectPage';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectId, useProjectMetaAnalysisCanEdit, useProjectUser } from 'stores/projects/ProjectStore';

const ExtractionAdvanceButton: React.FC<ButtonProps> = ({ sx: sxProp, ...restProps }) => {
    const navigate = useNavigate();
    const projectId = useProjectId();
    const projectUser = useProjectUser();
    const canEdit = useUserCanEdit(projectUser || undefined);
    const extractionSummary = useGetExtractionSummary(projectId || '');
    const metaAnalysisStepInitialized = useProjectMetaAnalysisCanEdit();

    const isReadyToMoveToNextStep = useMemo(
        () => extractionSummary.total === extractionSummary.completed && extractionSummary.total > 0,
        [extractionSummary]
    );
    const shouldIndicateReadyToStart = isReadyToMoveToNextStep && !metaAnalysisStepInitialized;

    const handleAdvance = () => {
        if (metaAnalysisStepInitialized) {
            navigate(`/projects/${projectId}/meta-analyses`);
            return;
        }

        if (!isReadyToMoveToNextStep) {
            enqueueSnackbar(
                <Box>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }} gutterBottom>
                        There are still studies that have not been marked as completed
                    </Typography>
                    <Typography variant="body2">
                        For each study that is not completed, verify that the extracted analyses are correct for that
                        study and then mark it as completed.
                    </Typography>
                    <Typography variant="body2">
                        Alternatively, you can automatically mark all studies as completed by clicking the button "Mark
                        all as complete".
                    </Typography>
                </Box>,
                { variant: 'warning', autoHideDuration: null }
            );
            return;
        }

        navigate(`/projects/${projectId}/project`, {
            state: {
                projectPage: {
                    scrollToMetaAnalysisProceed: true,
                },
            } as IProjectPageLocationState,
        });
    };

    return (
        <Button
            sx={{
                ...(shouldIndicateReadyToStart ? { ...GlobalStyles.colorPulseAnimation, color: 'success.dark' } : {}),
                ...(sxProp ? sxProp : {}),
            }}
            onClick={handleAdvance}
            color="success"
            variant={metaAnalysisStepInitialized || isReadyToMoveToNextStep ? 'contained' : 'text'}
            disableElevation
            disabled={!canEdit}
            {...restProps}
        >
            {shouldIndicateReadyToStart && <PriorityHigh sx={{ fontSize: '16px', marginRight: '4px' }} />}
            {metaAnalysisStepInitialized ? 'View meta-analyses' : 'Start Meta-Analysis'}
        </Button>
    );
};

export default ExtractionAdvanceButton;

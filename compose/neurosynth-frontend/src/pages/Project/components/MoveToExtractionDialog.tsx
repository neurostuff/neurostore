import { Box, CircularProgress, LinearProgress, Typography } from '@mui/material';
import BaseDialog, { IDialog } from 'components/Dialogs/BaseDialog';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import MoveToExtractionDialogIntroductionPart1 from 'pages/Project/components/MoveToExtractionDialogIntroPart1';
import MoveToExtractionDialogIntroductionPart2 from 'pages/Project/components/MoveToExtractionDialogIntroPart2';
import MoveToExtractionDialogSkipExtraction from 'pages/Project/components/MoveToExtractionDialogSkipExtraction';
import useInitExtraction from 'pages/Project/hooks/useInitExtraction';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectId } from 'stores/projects/ProjectStore';
import { IProjectPageLocationState } from '../ProjectPage';

const MoveToExtractionDialog = (props: IDialog) => {
    const projectId = useProjectId();
    const { doExtraction, reset, progress, progressText, isError } = useInitExtraction();
    const [step, setStep] = useState(0);
    const [showSkipPage, setShowSkipPage] = useState(false);
    const navigate = useNavigate();

    const handleCloseDialog = () => {
        reset();
        setStep(0);
        setShowSkipPage(false);
        props.onCloseDialog();
    };

    const handleSkipExtraction = async () => {
        setStep(2);
        setShowSkipPage(false);
        const didComplete = await doExtraction(true);
        if (didComplete) {
            props.onCloseDialog();
            navigate(`/projects/${projectId}/project`, {
                state: {
                    projectPage: {
                        scrollToMetaAnalysisProceed: true,
                    },
                } as IProjectPageLocationState,
            });
        }
    };

    const handleRequestSkipExtraction = () => {
        setShowSkipPage(true);
        setStep(0);
    };

    const handleCancelSkipExtraction = () => {
        setShowSkipPage(false);
        setStep(0);
    };

    const handleInitialize = async () => {
        setStep(2);
        const didComplete = await doExtraction(false);
        if (didComplete) {
            setTimeout(() => {
                props.onCloseDialog();
                navigate(`/projects/${projectId}/extraction`);
            }, 1000);
        }
    };

    const handleNavigateNext = () => {
        setStep((prev) => (prev < 2 ? prev + 1 : prev));
    };

    const handleNavigatePrev = () => {
        setStep((prev) => (prev > 0 ? prev - 1 : prev));
    };

    return (
        <BaseDialog
            dialogTitle="Extraction Phase: Get Started"
            isOpen={props.isOpen}
            fullWidth
            maxWidth="md"
            onCloseDialog={handleCloseDialog}
        >
            <StateHandlerComponent isLoading={false} isError={isError}>
                {showSkipPage ? (
                    <MoveToExtractionDialogSkipExtraction
                        onCancel={handleCancelSkipExtraction}
                        onConfirm={handleSkipExtraction}
                    />
                ) : step === 0 ? (
                    <MoveToExtractionDialogIntroductionPart1
                        onNext={handleNavigateNext}
                        onSkip={handleRequestSkipExtraction}
                    />
                ) : step === 1 ? (
                    <MoveToExtractionDialogIntroductionPart2 onPrev={handleNavigatePrev} onNext={handleInitialize} />
                ) : (
                    <Box
                        sx={{
                            height: '300px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <Box sx={{ width: '100%' }}>
                            <LinearProgress
                                sx={{ height: '10px', marginBottom: '1rem' }}
                                variant="determinate"
                                value={progress}
                            />
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <CircularProgress />
                            <Typography>{progressText}</Typography>
                            <Typography sx={{ marginTop: '1rem' }}>(This may take a minute)</Typography>
                        </Box>
                        {/* need this empty div to space out elements properly */}
                        <div></div>
                    </Box>
                )}
            </StateHandlerComponent>
        </BaseDialog>
    );
};

export default MoveToExtractionDialog;

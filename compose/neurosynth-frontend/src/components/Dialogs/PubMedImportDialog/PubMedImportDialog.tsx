import { Box, Button, Step, StepLabel, Stepper } from '@mui/material';
import NavigationButtons, {
    ENavigationButton,
} from 'components/Buttons/NavigationButtons/NavigationButtons';
import BaseDialog, { IDialog } from 'components/Dialogs/BaseDialog';
import { useState } from 'react';
import PubMedwizardDuplicateStep from './PubMedWizardDuplicateStep/PubMedWizardDuplicateStep';
import PubMedWizardFinalizeStep from './PubMedWizardFinalizeStep/PubMedWizardFinalizeStep';
import PubMedWizardTagStep from './PubMedWizardTagStep/PubMedWizardTagStep';
import PubMedWizardUploadStep from './PubMedWizardUploadStep/PubMedWizardUploadStep';

const PubmedImportDialog: React.FC<Omit<IDialog, 'dialogTitle'>> = (props) => {
    const [activeStep, setActiveStep] = useState(0);

    // step 1
    const [ids, setIds] = useState<string[]>([]);

    const handleChangeStep = (navigation: ENavigationButton) => {
        setActiveStep((prev) => {
            if (navigation === ENavigationButton.NEXT && prev < 3) {
                return prev + 1;
            } else if (navigation === ENavigationButton.PREV && prev > 0) {
                return prev - 1;
            } else {
                return prev;
            }
        });
    };

    return (
        <BaseDialog
            maxWidth="md"
            fullWidth
            onCloseDialog={props.onCloseDialog}
            isOpen={props.isOpen}
            dialogTitle="Import PubMed Studies"
        >
            <Box>
                <Stepper activeStep={activeStep}>
                    <Step>
                        <StepLabel>Upload</StepLabel>
                    </Step>
                    <Step>
                        <StepLabel>Tag</StepLabel>
                    </Step>
                    <Step>
                        <StepLabel>Remove Duplicates (optional)</StepLabel>
                    </Step>
                    <Step>
                        <StepLabel>Finalize</StepLabel>
                    </Step>
                </Stepper>

                <Box sx={{ margin: '1.5rem 0' }}>
                    {activeStep === 0 && (
                        <PubMedWizardUploadStep
                            onChangeStep={(navigation, ids) => {
                                setIds(ids.filter((x) => x.length > 0));
                                console.log(ids.filter((x) => x.length > 0));

                                handleChangeStep(navigation);
                            }}
                        />
                    )}
                    {activeStep === 1 && <PubMedWizardTagStep ids={ids} />}
                    {activeStep === 2 && <PubMedwizardDuplicateStep />}
                    {activeStep === 3 && <PubMedWizardFinalizeStep />}
                </Box>
            </Box>
        </BaseDialog>
    );
};

export default PubmedImportDialog;

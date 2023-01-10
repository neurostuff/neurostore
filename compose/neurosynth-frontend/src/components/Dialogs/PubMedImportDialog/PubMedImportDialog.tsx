import { Box, Step, StepLabel, Stepper } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudy';
import BaseDialog, { IDialog } from 'components/Dialogs/BaseDialog';
import { useState } from 'react';
import PubMedwizardDuplicateStep from './PubMedWizardDuplicateStep/PubMedWizardDuplicateStep';
import PubMedWizardTagStep from './PubMedWizardTagStep/PubMedWizardTagStep';
import PubMedWizardUploadStep from './PubMedWizardUploadStep/PubMedWizardUploadStep';

const PubmedImportDialog: React.FC<IDialog> = (props) => {
    const [activeStep, setActiveStep] = useState(0);

    // step 1
    const [ids, setIds] = useState<string[]>([]);
    // step 2
    const [stubStudies, setStubStudies] = useState<ICurationStubStudy[]>([]);

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

    const handleCompleteImport = () => {
        handleCloseDialog();
    };

    const handleCloseDialog = () => {
        props.onCloseDialog();
        setIds([]);
        setStubStudies([]);
        setActiveStep(0);
    };

    return (
        <BaseDialog
            maxWidth="md"
            fullWidth
            onCloseDialog={handleCloseDialog}
            isOpen={props.isOpen}
            dialogTitle="Import PubMed Studies"
        >
            <Box>
                <Stepper activeStep={activeStep}>
                    <Step>
                        <StepLabel>Upload</StepLabel>
                    </Step>
                    <Step>
                        <StepLabel>Tag (optional)</StepLabel>
                    </Step>
                    <Step>
                        <StepLabel>Resolve Duplicates and import</StepLabel>
                    </Step>
                </Stepper>

                <Box sx={{ margin: '1.5rem 0' }}>
                    {activeStep === 0 && (
                        <PubMedWizardUploadStep
                            onChangeStep={(navigation, ids) => {
                                setIds(ids.filter((x) => x.length > 0));
                                handleChangeStep(navigation);
                            }}
                        />
                    )}
                    {activeStep === 1 && (
                        <PubMedWizardTagStep
                            ids={ids}
                            stubs={stubStudies}
                            onChangeStep={(navigation, stubs) => {
                                if (navigation === ENavigationButton.NEXT) {
                                    setStubStudies(stubs);
                                } else {
                                    setStubStudies([]);
                                }
                                handleChangeStep(navigation);
                            }}
                        />
                    )}
                    {activeStep === 2 && (
                        <PubMedwizardDuplicateStep
                            onCompleteImport={handleCompleteImport}
                            onChangeStep={(nav) => {
                                handleChangeStep(nav);
                            }}
                            stubs={stubStudies}
                        />
                    )}
                </Box>
            </Box>
        </BaseDialog>
    );
};

export default PubmedImportDialog;

import { Box, Step, StepLabel, Stepper } from '@mui/material';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs/NeurosynthBreadcrumbs';
import SleuthImportWizardBuild from 'components/SleuthImportWizard/SleuthImportWizardBuild';
import SleuthImportWizardIntroduction from 'components/SleuthImportWizard/SleuthImportWizardIntroduction';
import SleuthImportWizardReview from 'components/SleuthImportWizard/SleuthImportWizardReview';
import SleuthImportWizardUpload from 'components/SleuthImportWizard/SleuthImportWizardUpload';
import { useState } from 'react';

const ImportSleuthPage: React.FC = (props) => {
    const [activeStep, setActiveStep] = useState(0);
    const [uploadedSleuthFiles, setUploadedSleuthFiles] = useState<string[]>([]);

    const handleNextFromIntroduction = () => {
        setActiveStep((prev) => prev + 1);
    };

    const handlePrevious = () => {
        setActiveStep((prev) => prev - 1);
    };

    const handleNextFromUpload = (sleuthFiles: string[]) => {
        setUploadedSleuthFiles(sleuthFiles);
        setActiveStep((prev) => prev + 1);
    };

    return (
        <Box>
            <Box sx={{ marginBottom: '1rem' }}>
                <NeurosynthBreadcrumbs
                    breadcrumbItems={[
                        {
                            text: 'Projects',
                            link: '/projects',
                            isCurrentPage: false,
                        },
                        {
                            text: 'Create project from sleuth file',
                            link: '',
                            isCurrentPage: true,
                        },
                    ]}
                />
            </Box>
            <Stepper activeStep={activeStep}>
                <Step>
                    <StepLabel>Introduction</StepLabel>
                </Step>
                <Step>
                    <StepLabel>Upload Sleuth File(s)</StepLabel>
                </Step>
                <Step>
                    <StepLabel>Build Project</StepLabel>
                </Step>
                <Step>
                    <StepLabel>Review</StepLabel>
                </Step>
            </Stepper>

            <Box sx={{ margin: '2rem 0' }}>
                {activeStep === 0 && (
                    <SleuthImportWizardIntroduction onNext={handleNextFromIntroduction} />
                )}
                {activeStep === 1 && (
                    <SleuthImportWizardUpload
                        onNext={handleNextFromUpload}
                        onPrevious={handlePrevious}
                    />
                )}
                {activeStep === 2 && <SleuthImportWizardBuild />}
                {activeStep === 3 && <SleuthImportWizardReview />}
            </Box>
        </Box>
    );
};

export default ImportSleuthPage;

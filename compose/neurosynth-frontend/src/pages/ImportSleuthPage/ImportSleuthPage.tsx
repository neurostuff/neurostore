import { Box, Step, StepLabel, Stepper } from '@mui/material';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs/NeurosynthBreadcrumbs';
import SleuthImportWizardBuild from 'components/SleuthImportWizard/SleuthImportWizardBuild';
import SleuthImportWizardReview from 'components/SleuthImportWizard/SleuthImportWizardReview';
import SleuthImportWizardUpload from 'components/SleuthImportWizard/SleuthImportWizardUpload';
import { useState } from 'react';

const ImportSleuthPage: React.FC = (props) => {
    const [activeStep, setActiveStep] = useState(0);

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
                {activeStep === 0 && <SleuthImportWizardUpload />}
                {activeStep === 1 && <SleuthImportWizardBuild />}
                {activeStep === 2 && <SleuthImportWizardReview />}
            </Box>
        </Box>
    );
};

export default ImportSleuthPage;

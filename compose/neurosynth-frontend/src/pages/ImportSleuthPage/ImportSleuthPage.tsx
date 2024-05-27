import { Box, Step, StepLabel, Stepper } from '@mui/material';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs/NeurosynthBreadcrumbs';
import { ISleuthFileUploadStubs } from 'components/SleuthImportWizard/SleuthImportWizard.utils';
import SleuthImportWizardBuild from 'components/SleuthImportWizard/SleuthImportWizardBuild';
import SleuthImportWizardCreateMetaAnalysesBase from 'components/SleuthImportWizard/SleuthImportWizardCreateMetaAnalysesBase';
import SleuthImportWizardIntroduction from 'components/SleuthImportWizard/SleuthImportWizardIntroduction';
import SleuthImportWizardUpload from 'components/SleuthImportWizard/SleuthImportWizardUpload';
import { useState } from 'react';

const ImportSleuthPage: React.FC = (props) => {
    const [activeStep, setActiveStep] = useState(0);
    const [uploadedSleuthFiles, setUploadedSleuthFiles] = useState<ISleuthFileUploadStubs[]>([]);
    const [projectId, setProjectId] = useState('');

    const handleNextFromIntroduction = () => {
        setActiveStep((prev) => prev + 1);
    };

    const handlePrevious = () => {
        setActiveStep((prev) => prev - 1);
    };

    const handleNextFromUpload = (sleuthFiles: ISleuthFileUploadStubs[]) => {
        setUploadedSleuthFiles(sleuthFiles);
        setActiveStep((prev) => prev + 1);
    };

    const handleNextFromBuild = (createdProjectId: string) => {
        setProjectId(createdProjectId);
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
                    <StepLabel>Meta Analyses</StepLabel>
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
                {activeStep === 2 && (
                    <SleuthImportWizardBuild
                        sleuthUploads={uploadedSleuthFiles}
                        onNext={handleNextFromBuild}
                    />
                )}
                {activeStep === 3 && (
                    <SleuthImportWizardCreateMetaAnalysesBase
                        projectId={projectId}
                        sleuthImports={uploadedSleuthFiles}
                    />
                )}
            </Box>
        </Box>
    );
};

export default ImportSleuthPage;

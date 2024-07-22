import { useAuth0 } from '@auth0/auth0-react';
import { Box, Step, StepLabel, Stepper } from '@mui/material';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs';
import { useGuard } from 'hooks';
import { useState } from 'react';
import { ISleuthFileUploadStubs } from 'pages/SleuthImport/SleuthImport.helpers';
import SleuthImportWizardBuild from 'pages/SleuthImport/components/SleuthImportWizardBuild';
import SleuthImportWizardCreateMetaAnalyses from 'pages/SleuthImport/components/SleuthImportWizardCreateMetaAnalyses';
import SleuthImportWizardIntroduction from 'pages/SleuthImport/components/SleuthImportWizardIntroduction';
import SleuthImportWizardUpload from 'pages/SleuthImport/components/SleuthImportWizardUpload';

const SleuthImportPage: React.FC = (props) => {
    const [activeStep, setActiveStep] = useState(0);
    const [uploadedSleuthFiles, setUploadedSleuthFiles] = useState<ISleuthFileUploadStubs[]>([]);
    const [projectComponents, setProjectComponents] = useState({
        projectId: '',
        studysetId: '',
        annotationId: '',
    });
    const { isLoading, isAuthenticated } = useAuth0();
    useGuard(`/`, 'You must be signed in to access this page.', !isAuthenticated && !isLoading);

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

    const handleNextFromBuild = (
        createdProjectId: string,
        createdStudysetId: string,
        createdAnnotationId: string
    ) => {
        setProjectComponents({
            projectId: createdProjectId,
            studysetId: createdStudysetId,
            annotationId: createdAnnotationId,
        });
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
                    <SleuthImportWizardCreateMetaAnalyses
                        projectId={projectComponents.projectId}
                        studysetId={projectComponents.studysetId}
                        annotationId={projectComponents.annotationId}
                        sleuthImports={uploadedSleuthFiles}
                    />
                )}
            </Box>
        </Box>
    );
};

export default SleuthImportPage;

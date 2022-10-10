import { Step, StepLabel, Stepper } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import { IPubmedArticle } from 'hooks/requests/useGetPubmedIDs';
import MetaAnalysisBuilderPageStyles from 'pages/MetaAnalyses/MetaAnalysisBuilderPage/MetaAnalysisBuilderPage.styles';
import { useState } from 'react';
import PubmedWizardConfirmStep from './PubmedWizardConfirmStep/PubmedWizardConfirmStep';
import PubmedWizardFilterStep from './PubmedWizardFilterStep/PubmedWizardFilterStep';
import PubmedWizardUploadStep from './PubmedWizardUploadStep/PubmedWizardUploadStep';

interface IPubmedIdUploadWizard {
    onClose: (event: any) => void;
    onUploadIds: (pubmedIds: IPubmedArticle[]) => void;
}

const PubmedIdUploadWizard: React.FC<IPubmedIdUploadWizard> = (props) => {
    const [activeStep, setActiveStep] = useState(0);

    // STEP 1
    const [uploadedIds, setUploadedIds] = useState<string>(''); // ids uploaded as strings
    const [uploadedFile, setUploadedFile] = useState<{ file?: File; uploadedIDs: string[] }>(); // ids uploaded via a file

    // STEP 2
    const [selectedPubmedArticles, setSelectedPubmedArticles] = useState<IPubmedArticle[]>([]); // pubmed articles that have been included

    const handlePubmedIdsInputted = (inputtedIds: string) => {
        setUploadedIds(inputtedIds);
    };

    const handleNavigation = (button: ENavigationButton) => {
        setActiveStep((prev) => (button === ENavigationButton.NEXT ? ++prev : --prev));
    };

    const handleFileUploaded = (file: File) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const content = reader.result;
            if (content && typeof content === 'string') {
                const list = content.split(/\r?\n/);
                setUploadedFile({
                    file,
                    uploadedIDs: list,
                });
            }
        };
        reader.readAsText(file);
    };

    const handleArticlesSelected = (selectedArticles: IPubmedArticle[]) => {
        setSelectedPubmedArticles(selectedArticles);
    };

    const uploadedIdsToStringArr = uploadedIds.split(/\r?\n/);

    return (
        <>
            <Stepper sx={{ marginBottom: '1.5rem' }} activeStep={activeStep}>
                <Step>
                    <StepLabel sx={MetaAnalysisBuilderPageStyles.step}>Upload</StepLabel>
                </Step>
                <Step>
                    <StepLabel sx={MetaAnalysisBuilderPageStyles.step}>Filter</StepLabel>
                </Step>
                <Step>
                    <StepLabel sx={MetaAnalysisBuilderPageStyles.step}>Confirm</StepLabel>
                </Step>
            </Stepper>

            {activeStep === 0 && (
                <PubmedWizardUploadStep
                    onChangeStep={handleNavigation}
                    onFileUpload={handleFileUploaded}
                    onPubmedIdsInputted={handlePubmedIdsInputted}
                    uploadedFile={uploadedFile?.file}
                    inputtedPubmedIds={uploadedIds}
                />
            )}

            {activeStep === 1 && (
                <PubmedWizardFilterStep
                    onSelectArticles={handleArticlesSelected}
                    onChangeStep={handleNavigation}
                    pubmedIds={uploadedFile?.uploadedIDs || uploadedIdsToStringArr}
                />
            )}

            {activeStep === 2 && (
                <PubmedWizardConfirmStep
                    onUploadPubmedArticles={props.onUploadIds}
                    onClose={props.onClose}
                    selectedPubmedArticles={selectedPubmedArticles}
                />
            )}
        </>
    );
};

export default PubmedIdUploadWizard;

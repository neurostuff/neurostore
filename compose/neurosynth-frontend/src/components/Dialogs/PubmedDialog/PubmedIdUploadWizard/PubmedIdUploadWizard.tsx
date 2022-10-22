import { Box, Step, StepLabel, Stepper } from '@mui/material';
import { ITag } from 'components/AnnotationContainer/DraggableItem/DraggableItem';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import { IPubmedArticle } from 'hooks/requests/useGetPubmedIDs';
import MetaAnalysisBuilderPageStyles from 'pages/MetaAnalyses/MetaAnalysisBuilderPage/MetaAnalysisBuilderPage.styles';
import { useState } from 'react';
import PubmedWizardCompleteStep from './PubmedWizardCompleteStep/PubmedWizardCompleteStep';
import PubmedWizardConfirmStep from './PubmedWizardConfirmStep/PubmedWizardConfirmStep';
import PubmedWizardUploadStep from './PubmedWizardUploadStep/PubmedWizardUploadStep';

interface IPubmedIdUploadWizard {
    onClose: (event: any) => void;
    onCreateTag: (tagName: string, isExclusion: boolean) => ITag;
    allTags: ITag[];
    onUploadIds: (pubmedIds: IPubmedArticle[], tags: ITag[]) => void;
}

const PubmedIdUploadWizard: React.FC<IPubmedIdUploadWizard> = (props) => {
    const [activeStep, setActiveStep] = useState(0);

    // STEP 1
    const [uploadedIds, setUploadedIds] = useState<string>(''); // ids uploaded as strings
    const [uploadedFile, setUploadedFile] = useState<{ file?: File; uploadedIDs: string[] }>(); // ids uploaded via a file

    // STEP 2
    const [selectedPubmedArticles, setSelectedPubmedArticles] = useState<IPubmedArticle[]>([]); // pubmed articles that have been included
    const [selectedTags, setSelectedTags] = useState<ITag[]>([]);

    const handleUpdateTags = (tags: ITag[]) => {
        setSelectedTags(tags);
    };

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

    const handleArticlesSelected = (articles: IPubmedArticle[]) => {
        setSelectedPubmedArticles(articles);
    };

    const uploadedIdsToStringArr = uploadedIds.split(/\r?\n/);

    return (
        <Box sx={{ padding: '1.5rem 2.5rem 2.5rem 2.5rem' }}>
            <Stepper sx={{ marginBottom: '2rem' }} activeStep={activeStep}>
                <Step>
                    <StepLabel sx={MetaAnalysisBuilderPageStyles.step}>Upload</StepLabel>
                </Step>
                <Step>
                    <StepLabel sx={MetaAnalysisBuilderPageStyles.step}>Confirm</StepLabel>
                </Step>
                <Step>
                    <StepLabel sx={MetaAnalysisBuilderPageStyles.step}>Complete</StepLabel>
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
                <PubmedWizardConfirmStep
                    allTags={props.allTags}
                    onChangeStep={handleNavigation}
                    onCreateTag={props.onCreateTag}
                    onUploadArticles={handleArticlesSelected}
                    selectedTags={selectedTags}
                    onUpdateTags={handleUpdateTags}
                    pubmedIds={uploadedFile?.uploadedIDs || uploadedIdsToStringArr}
                />
            )}

            {activeStep === 2 && (
                <PubmedWizardCompleteStep
                    onUploadPubmedArticles={props.onUploadIds}
                    onClose={props.onClose}
                    selectedTags={selectedTags}
                    selectedPubmedArticles={selectedPubmedArticles}
                />
            )}
        </Box>
    );
};

export default PubmedIdUploadWizard;

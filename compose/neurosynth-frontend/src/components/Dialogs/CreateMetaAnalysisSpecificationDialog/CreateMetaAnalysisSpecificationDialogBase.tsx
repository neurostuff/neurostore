import { Box, Step, StepLabel, Stepper } from '@mui/material';
import BaseDialog, { IDialog } from '../BaseDialog';
import { useEffect, useState } from 'react';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import CreateMetaAnalysisSpecificationSelectionStep from './CreateMetaAnalysisSpecificationSelectionStep/CreateMetaAnalysisSpecificationSelectionStep';
import { EPropertyType } from 'components/EditMetadata';
import CreateMetaAnalysisSpecificationAlgorithmStep from './CreateMetaAnalysisSpecificationAlgorithmStep/CreateMetaAnalysisSpecificationAlgorithmStep';
import { IDynamicValueType } from 'components/MetaAnalysisConfigComponents';
import CreateMetaAnalysisSpecificationReview from './CreateMetaAnalysisSpecificationReview/CreateMetaAnalysisSpecificationReview';
import { IAutocompleteObject } from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import CreateMetaAnalysisSpecificationDetailsStep from './CreateMetaAnalysisSpecificationDetailsStep/CreateMetaAnalysisSpecificationDetailsStep';
import { useProjectName } from 'pages/Projects/ProjectPage/ProjectStore';

const CreateMetaAnalysisSpecificationDialogBase: React.FC<IDialog> = (props) => {
    const projectName = useProjectName();

    const [activeStep, setActiveStep] = useState(0);
    const [details, setDetails] = useState({
        name: `${projectName} Meta Analysis`,
        description: `this is a meta-analysis for ${projectName}`,
    });
    const [selection, setSelection] = useState<{
        selectionKey: string | undefined;
        type: EPropertyType;
    }>();
    const [algorithm, setAlgorithm] = useState<{
        estimator: IAutocompleteObject | null;
        estimatorArgs: IDynamicValueType;
        corrector: IAutocompleteObject | null;
        correctorArgs: IDynamicValueType;
    }>({
        estimator: null,
        estimatorArgs: {},
        corrector: null,
        correctorArgs: {},
    });

    useEffect(() => {
        setDetails({
            name: ``,
            description: ``,
        });
    }, [projectName]);

    const handleCloseDialog = () => {
        props.onCloseDialog();
        setActiveStep(0);
        setAlgorithm({
            estimator: null,
            estimatorArgs: {},
            corrector: null,
            correctorArgs: {},
        });
        setSelection(undefined);
    };

    const handleNavigate = (button: ENavigationButton) => {
        setActiveStep((prev) => {
            if (button === ENavigationButton.NEXT) {
                if (activeStep < 3) return prev + 1;
                return prev;
            } else {
                if (activeStep > 0) return prev - 1;
                return prev;
            }
        });
    };

    const handleUpdateDetails = (details: { name: string; description: string }) => {
        setDetails({
            ...details,
        });
    };

    const handleChooseSelection = (selectionKey: string, type: EPropertyType) => {
        console.log({ selectionKey, type });
        setSelection({
            selectionKey,
            type,
        });
    };

    const handleChooseAlgorithm = (
        estimator: IAutocompleteObject,
        estimatorArgs: IDynamicValueType,
        corrector: IAutocompleteObject | null,
        correctorArgs: IDynamicValueType
    ) => {
        setAlgorithm({
            estimator,
            estimatorArgs,
            corrector,
            correctorArgs,
        });
    };

    return (
        <BaseDialog
            dialogTitle="Create Meta-Analysis Specification"
            isOpen={props.isOpen}
            fullWidth
            maxWidth="md"
            onCloseDialog={handleCloseDialog}
        >
            <Box>
                <Stepper activeStep={activeStep}>
                    <Step>
                        <StepLabel>Enter Details</StepLabel>
                    </Step>
                    <Step>
                        <StepLabel>Select Analyses</StepLabel>
                    </Step>
                    <Step>
                        <StepLabel>Enter Specification</StepLabel>
                    </Step>
                    <Step>
                        <StepLabel>Review</StepLabel>
                    </Step>
                </Stepper>
                <Box sx={{ marginTop: '1rem' }}>
                    {activeStep === 0 && (
                        <CreateMetaAnalysisSpecificationDetailsStep
                            details={details}
                            onUpdateDetails={handleUpdateDetails}
                            onNavigate={handleNavigate}
                        />
                    )}
                    {activeStep === 1 && (
                        <CreateMetaAnalysisSpecificationSelectionStep
                            onChooseSelection={handleChooseSelection}
                            selection={selection}
                            onNavigate={handleNavigate}
                        />
                    )}
                    {activeStep === 2 && (
                        <CreateMetaAnalysisSpecificationAlgorithmStep
                            onChooseAlgorithm={handleChooseAlgorithm}
                            algorithm={algorithm}
                            onNavigate={handleNavigate}
                        />
                    )}
                    {activeStep === 3 && (
                        <CreateMetaAnalysisSpecificationReview
                            selection={selection}
                            onClose={handleCloseDialog}
                            algorithm={algorithm}
                            onNavigate={handleNavigate}
                            details={details}
                        />
                    )}
                </Box>
            </Box>
        </BaseDialog>
    );
};

export default CreateMetaAnalysisSpecificationDialogBase;

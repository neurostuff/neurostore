import { Box, Step, StepLabel, Stepper } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import { IDynamicValueType } from 'components/MetaAnalysisConfigComponents';
import { IAutocompleteObject } from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import { useProjectName } from 'pages/Projects/ProjectPage/ProjectStore';
import { useEffect, useState } from 'react';
import BaseDialog, { IDialog } from '../BaseDialog';
import CreateMetaAnalysisSpecificationAlgorithmStep from './CreateMetaAnalysisSpecificationAlgorithmStep/CreateMetaAnalysisSpecificationAlgorithmStep';
import CreateMetaAnalysisSpecificationDetailsStep from './CreateMetaAnalysisSpecificationDetailsStep/CreateMetaAnalysisSpecificationDetailsStep';
import {
    IAlgorithmSelection,
    IAnalysesSelection,
} from './CreateMetaAnalysisSpecificationDialogBase.types';
import CreateMetaAnalysisSpecificationReview from './CreateMetaAnalysisSpecificationReview/CreateMetaAnalysisSpecificationReview';
import CreateMetaAnalysisSpecificationSelectionStep from './CreateMetaAnalysisSpecificationSelectionStep/CreateMetaAnalysisSpecificationSelectionStep';
import { correctorOpt, algorithmOpt } from './CreateMetaAnalysisSpecificationDialogConstants';

const CreateMetaAnalysisSpecificationDialogBase: React.FC<IDialog> = (props) => {
    const projectName = useProjectName();

    const [activeStep, setActiveStep] = useState(0);
    const [details, setDetails] = useState({
        name: `${projectName} Meta Analysis`,
        description: `this is a meta-analysis for ${projectName}`,
    });
    const [selection, setSelection] = useState<IAnalysesSelection>({
        selectionKey: undefined,
        selectionValue: undefined,
        type: undefined,
        referenceDataset: undefined,
    });
    const [algorithm, setAlgorithm] = useState<IAlgorithmSelection>({
        estimator: algorithmOpt,
        estimatorArgs: {},
        corrector: correctorOpt,
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
            estimator: algorithmOpt,
            estimatorArgs: {},
            corrector: correctorOpt,
            correctorArgs: {},
        });
        setSelection({
            selectionKey: undefined,
            selectionValue: undefined,
            type: undefined,
            referenceDataset: undefined,
        });
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

    const handleChooseSelection = (selection: IAnalysesSelection) => {
        setSelection({
            ...selection,
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
            dialogTitleSx={{ padding: '1rem 0rem 0rem 4rem' }}
            maxWidth="lg"
            onCloseDialog={handleCloseDialog}
        >
            <Box sx={{ padding: '2rem' }}>
                <Stepper activeStep={activeStep}>
                    <Step>
                        <StepLabel>Enter Specification</StepLabel>
                    </Step>
                    <Step>
                        <StepLabel>Select Analyses</StepLabel>
                    </Step>
                    <Step>
                        <StepLabel>Enter Details</StepLabel>
                    </Step>
                    <Step>
                        <StepLabel>Review</StepLabel>
                    </Step>
                </Stepper>
                <Box sx={{ marginTop: '1rem' }}>
                    {activeStep === 0 && (
                        <CreateMetaAnalysisSpecificationAlgorithmStep
                            onChooseAlgorithm={handleChooseAlgorithm}
                            algorithm={algorithm}
                            onNavigate={handleNavigate}
                        />
                    )}
                    {activeStep === 1 && (
                        <CreateMetaAnalysisSpecificationSelectionStep
                            onChooseSelection={handleChooseSelection}
                            algorithm={algorithm}
                            selection={selection}
                            onNavigate={handleNavigate}
                        />
                    )}
                    {activeStep === 2 && (
                        <CreateMetaAnalysisSpecificationDetailsStep
                            details={details}
                            selectionKey={selection?.selectionKey}
                            algorithmName={algorithm?.estimator?.label}
                            correctorName={algorithm?.corrector?.label}
                            onUpdateDetails={handleUpdateDetails}
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

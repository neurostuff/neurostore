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
import {
    IAlgorithmSelection,
    IAnalysesSelection,
} from './CreateMetaAnalysisSpecificationDialogBase.types';
import { AnnotationNoteValue } from 'components/HotTables/HotTables.types';

const CreateMetaAnalysisSpecificationDialogBase: React.FC<IDialog> = (props) => {
    const projectName = useProjectName();

    const [activeStep, setActiveStep] = useState(0);
    const [details, setDetails] = useState({
        name: `${projectName} Meta Analysis`,
        description: `this is a meta-analysis for ${projectName}`,
    });
    const [selection, setSelection] = useState<IAnalysesSelection>();
    const [algorithm, setAlgorithm] = useState<IAlgorithmSelection>({
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

    const handleChooseSelection = (
        selectionKey: string,
        type: EPropertyType,
        selectionValue?: AnnotationNoteValue
    ) => {
        setSelection({
            selectionKey,
            type,
            selectionValue: selectionValue ? selectionValue : undefined,
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

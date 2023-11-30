import { Box, Button, Typography } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import { EPropertyType } from 'components/EditMetadata';
import {
    useProjectExtractionAnnotationId,
    useProjectExtractionStudysetId,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { useState } from 'react';
import {
    IAlgorithmSelection,
    IAnalysesSelection,
} from 'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationDialogBase.types';
import SelectAnalysesComponent from 'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationSelectionStep/SelectAnalysesComponent/SelectAnalysesComponent';
import { isMultiGroupAlgorithm } from 'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationSelectionStep/SelectAnalysesComponent/SelectAnalysesComponent.helpers';
import SelectAnalysesSummaryComponent from 'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationSelectionStep/SelectAnalysesComponent/SelectAnalysesSummaryComponent';
import CreateMetaAnalysisSpecificationSelectionStepMultiGroup from 'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationSelectionStep/CreateMetaAnalysisSpecificationSelectionStepMultiGroup';

const CreateMetaAnalysisSpecificationSelectionStep: React.FC<{
    onChooseSelection: (selection: IAnalysesSelection) => void;
    onNavigate: (button: ENavigationButton) => void;
    selection: IAnalysesSelection;
    algorithm: IAlgorithmSelection;
}> = (props) => {
    const annotationId = useProjectExtractionAnnotationId();
    const studysetId = useProjectExtractionStudysetId();
    const isMultiGroup = isMultiGroupAlgorithm(props.algorithm?.estimator);

    const [selectedValue, setSelectedValue] = useState<IAnalysesSelection>(props.selection);

    const handleNavigate = (button: ENavigationButton) => {
        if (selectedValue?.selectionKey && selectedValue?.type !== EPropertyType.NONE)
            props.onChooseSelection({
                ...selectedValue,
            });
        props.onNavigate(button);
    };

    return (
        <Box>
            <Box>
                <Typography gutterBottom>
                    At this time, all of the studies within your studyset should have all the
                    relevant information (i.e. coordinates, annotations) needed for a meta-analysis
                </Typography>
            </Box>
            <Box>
                <Typography gutterBottom sx={{ marginBottom: '1rem' }}>
                    Select the <b>annotation inclusion column</b> that you would like to use to
                    select the analyses for your meta-analysis.
                </Typography>

                <SelectAnalysesComponent
                    selectedValue={selectedValue}
                    onSelectValue={(val) => setSelectedValue(val)}
                    annotationId={annotationId || ''}
                    algorithm={props.algorithm}
                />
                {isMultiGroup && (
                    <CreateMetaAnalysisSpecificationSelectionStepMultiGroup
                        onSelectValue={(newVal) => setSelectedValue(newVal)}
                        annotationId={annotationId}
                        selectedValue={selectedValue}
                        algorithm={props.algorithm}
                    />
                )}

                <Box
                    sx={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <Button
                        onClick={() => handleNavigate(ENavigationButton.PREV)}
                        variant="outlined"
                    >
                        back
                    </Button>
                    <SelectAnalysesSummaryComponent
                        annotationdId={annotationId || ''}
                        studysetId={studysetId || ''}
                        selectedValue={selectedValue}
                    />
                    <Button
                        variant="contained"
                        disabled={
                            !selectedValue?.selectionKey ||
                            selectedValue?.selectionValue === undefined ||
                            (isMultiGroup && !selectedValue?.referenceDataset) // we need a ref dataset for multigroup algos
                        }
                        onClick={() => handleNavigate(ENavigationButton.NEXT)}
                    >
                        next
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

export default CreateMetaAnalysisSpecificationSelectionStep;

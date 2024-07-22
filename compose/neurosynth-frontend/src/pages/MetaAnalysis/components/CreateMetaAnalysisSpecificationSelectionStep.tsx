import { Box, Button, Link, Typography } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import {
    useProjectExtractionAnnotationId,
    useProjectExtractionStudysetId,
} from 'pages/Project/store/ProjectStore';
import { useState } from 'react';
import {
    IAnalysesSelection,
    IAlgorithmSelection,
} from 'pages/MetaAnalysis/components/CreateMetaAnalysisSpecificationDialogBase.types';
import CreateMetaAnalysisSpecificationSelectionStepMultiGroup from 'pages/MetaAnalysis/components/CreateMetaAnalysisSpecificationSelectionStepMultiGroup';
import SelectAnalysesComponent from 'pages/MetaAnalysis/components/SelectAnalysesComponent';
import { isMultiGroupAlgorithm } from 'pages/MetaAnalysis/components/SelectAnalysesComponent.helpers';
import SelectAnalysesSummaryComponent from 'pages/MetaAnalysis/components/SelectAnalysesSummaryComponent';

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
                <Typography gutterBottom>
                    Select the{' '}
                    <Link
                        target="_blank"
                        rel="noreferrer"
                        href="https://neurostuff.github.io/compose-docs/guide/glossary#annotation"
                    >
                        annotation
                    </Link>{' '}
                    column for inclusion. This will determine which{' '}
                    <Link
                        target="_blank"
                        rel="noreferrer"
                        href="https://neurostuff.github.io/compose-docs/guide/glossary#analysis"
                    >
                        analyses
                    </Link>{' '}
                    are used for this meta-analysis.
                </Typography>

                <Typography gutterBottom sx={{ marginBottom: '1rem' }}>
                    By default, the "included" column includes all studies & analyses. At the
                    moment, only boolean and string annotations are supported.
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
                        marginTop: '1rem',
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

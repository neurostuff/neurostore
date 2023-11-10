import { Box, Button, Typography } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import { EPropertyType } from 'components/EditMetadata';
import {
    useProjectExtractionAnnotationId,
    useProjectExtractionStudysetId,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { useState } from 'react';
import SelectAnalysesComponent from './SelectAnalysesComponent/SelectAnalysesComponent';
import SelectAnalysesSummaryComponent from './SelectAnalysesComponent/SelectAnalysesSummaryComponent';
import {
    IAlgorithmSelection,
    IAnalysesSelection,
} from '../CreateMetaAnalysisSpecificationDialogBase.types';
import { AnnotationNoteValue } from 'components/HotTables/HotTables.types';

const CreateMetaAnalysisSpecificationSelectionStep: React.FC<{
    onChooseSelection: (
        selectionKey: string,
        type: EPropertyType,
        selectionValue?: AnnotationNoteValue
    ) => void;
    onNavigate: (button: ENavigationButton) => void;
    selection: IAnalysesSelection | undefined;
    algorithm: IAlgorithmSelection;
}> = (props) => {
    const annotationId = useProjectExtractionAnnotationId();
    const studysetId = useProjectExtractionStudysetId();
    const [selectedValue, setSelectedValue] = useState<IAnalysesSelection | undefined>(
        props.selection
    );

    const handleNavigate = (button: ENavigationButton) => {
        if (selectedValue?.selectionKey && selectedValue?.type !== EPropertyType.NONE)
            props.onChooseSelection(
                selectedValue.selectionKey,
                selectedValue.type,
                selectedValue.selectionValue
            );
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
                    annotationdId={annotationId || ''}
                    algorithm={props.algorithm}
                />

                <Box
                    sx={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <SelectAnalysesSummaryComponent
                        annotationdId={annotationId || ''}
                        studysetId={studysetId || ''}
                        selectedValue={selectedValue}
                    />
                    <Button
                        variant="contained"
                        sx={{ width: '200px' }}
                        disabled={
                            !selectedValue?.selectionKey ||
                            selectedValue?.selectionValue === undefined
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

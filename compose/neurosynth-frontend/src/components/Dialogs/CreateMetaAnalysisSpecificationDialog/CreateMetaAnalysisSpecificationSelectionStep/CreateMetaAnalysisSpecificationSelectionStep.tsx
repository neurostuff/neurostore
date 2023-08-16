import { Box, Button, Typography } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import { EPropertyType } from 'components/EditMetadata';
import {
    useProjectExtractionAnnotationId,
    useProjectExtractionStudysetId,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { useState } from 'react';
import SelectAnalysesComponent from './SelectAnalysesComponent/SelectAnalysesComponent';
import SelectAnalysesSummaryComponent from './SelectAnalysesSummaryComponent/SelectAnalysesSummaryComponent';

const CreateMetaAnalysisSpecificationSelectionStep: React.FC<{
    onChooseSelection: (selectionKey: string, type: EPropertyType) => void;
    onNavigate: (button: ENavigationButton) => void;
    selection: { selectionKey: string | undefined; type: EPropertyType } | undefined;
}> = (props) => {
    const annotationId = useProjectExtractionAnnotationId();
    const studysetId = useProjectExtractionStudysetId();
    const [selectedValue, setSelectedValue] = useState<
        | {
              selectionKey: string | undefined;
              type: EPropertyType;
          }
        | undefined
    >(props.selection);

    const handleNavigate = (button: ENavigationButton) => {
        if (selectedValue?.selectionKey && selectedValue?.type !== EPropertyType.NONE)
            props.onChooseSelection(selectedValue.selectionKey, selectedValue.type);
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
                    Select the <b>annotation inclusion column</b> that you would like to use to
                    select the analyses for your meta-analysis.
                </Typography>
                <Typography sx={{ color: 'warning.dark', marginBottom: '1rem' }}>
                    At the moment, only boolean columns will be supported. We will be adding support
                    for the other types in the near future.
                </Typography>

                <SelectAnalysesComponent
                    selectedValue={selectedValue}
                    onSelectValue={(val) => setSelectedValue(val)}
                    annotationdId={annotationId || ''}
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
                        disabled={!selectedValue?.selectionKey}
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

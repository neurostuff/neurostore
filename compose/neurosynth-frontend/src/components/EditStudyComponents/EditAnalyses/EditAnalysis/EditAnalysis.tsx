import { Box, Button, Typography } from '@mui/material';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog/ConfirmationDialog';
import DisplayAnalysisWarnings from 'components/DisplayStudy/DisplayAnalyses/DisplayAnalysisWarnings/DisplayAnalysisWarnings';
import EditAnalysisDetails from 'components/EditStudyComponents/EditAnalyses/EditAnalysisDetails/EditAnalysisDetails';
import { useDeleteAnalysis } from 'pages/Studies/StudyStore';
import { useState } from 'react';
import { useDeleteAnnotationNote } from 'stores/AnnotationStore.actions';
import EditAnalysisPoints from '../EditAnalysisPoints/EditAnalysisPoints/EditAnalysisPoints';

const EditAnalysis: React.FC<{ analysisId?: string; onDeleteAnalysis: () => void }> = (props) => {
    const deleteAnalysis = useDeleteAnalysis();
    const deleteAnnotationNote = useDeleteAnnotationNote();

    const [dialogIsOpen, setDialogIsOpen] = useState(false);

    if (!props.analysisId) {
        return <Typography sx={{ color: 'warning.dark' }}>No analysis selected</Typography>;
    }

    const handleCloseDialog = (confirm?: boolean) => {
        if (confirm && props.analysisId) {
            deleteAnalysis(props.analysisId);
            deleteAnnotationNote(props.analysisId);
            props.onDeleteAnalysis();
        }
        setDialogIsOpen(false);
    };

    return (
        <Box sx={{ marginBottom: '2rem', width: '100%' }}>
            <DisplayAnalysisWarnings analysisId={props.analysisId} />
            <EditAnalysisDetails analysisId={props.analysisId} />
            <EditAnalysisPoints analysisId={props.analysisId} />
            {/* TODO: This can be added back later when we have a better understanding of where it fits in as currently, all meta-analysis algorithms do not use this */}
            {/* <Box sx={{ marginTop: '2rem' }}>
                <Typography sx={{ marginBottom: '1rem', fontWeight: 'bold' }}>
                    Analysis Conditions
                </Typography>
                <EditAnalysisConditions analysisId={props.analysisId} />
            </Box> */}
            <Box sx={{ marginTop: '2rem' }}>
                <ConfirmationDialog
                    isOpen={dialogIsOpen}
                    dialogTitle="Are you sure you want to delete this analysis?"
                    onCloseDialog={handleCloseDialog}
                    confirmText="delete analysis"
                    rejectText="cancel"
                />
                <Button
                    variant="contained"
                    onClick={() => setDialogIsOpen(true)}
                    disableElevation
                    color="error"
                >
                    Delete Analysis
                </Button>
            </Box>
        </Box>
    );
};

export default EditAnalysis;

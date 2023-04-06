import { Box, Button, Typography } from '@mui/material';
import EditAnalysisConditions from '../EditAnalysisConditions/EditAnalysisConditions';
import EditAnalysisDetails from '../EditAnalysisDetails/EditAnalysisDetails';
import EditAnalysisPoints from '../EditAnalysisPoints/EditAnalysisPoints';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog/ConfirmationDialog';
import { useDeleteAnalysis } from 'pages/Studies/StudyStore';
import { useState } from 'react';

const EditAnalysis: React.FC<{ analysisId?: string }> = (props) => {
    const deleteAnalysis = useDeleteAnalysis();

    const [dialogIsOpen, setDialogIsOpen] = useState(false);

    if (!props.analysisId) {
        return <Typography sx={{ color: 'warning.dark' }}>No analysis selected</Typography>;
    }

    const handleCloseDialog = (confirm?: boolean) => {
        if (confirm && props.analysisId) deleteAnalysis(props.analysisId);
        setDialogIsOpen(false);
    };

    return (
        <Box sx={{ marginBottom: '2rem', width: '100%' }}>
            <Box>
                <Typography sx={{ marginBottom: '1rem', fontWeight: 'bold' }}>
                    Analysis Details
                </Typography>
                <EditAnalysisDetails analysisId={props.analysisId} />
            </Box>

            <Box sx={{ marginTop: '2rem', width: '100%' }}>
                <Typography sx={{ marginBottom: '1rem', fontWeight: 'bold' }}>
                    Analysis Coordinates
                </Typography>
                <EditAnalysisPoints analysisId={props.analysisId} />
            </Box>
            <Box sx={{ marginTop: '2rem' }}>
                <Typography sx={{ marginBottom: '1rem', fontWeight: 'bold' }}>
                    Analysis Conditions
                </Typography>
                <EditAnalysisConditions analysisId={props.analysisId} />
            </Box>
            <Box sx={{ marginTop: '2rem' }}>
                <ConfirmationDialog
                    isOpen={dialogIsOpen}
                    dialogTitle="Are you sure you want to delete this analysis?"
                    onCloseDialog={handleCloseDialog}
                    confirmText="delete analysis"
                    rejectText="cancel"
                />
                <Button onClick={() => setDialogIsOpen(true)} variant="outlined" color="error">
                    Delete Analysis
                </Button>
            </Box>
        </Box>
    );
};

export default EditAnalysis;

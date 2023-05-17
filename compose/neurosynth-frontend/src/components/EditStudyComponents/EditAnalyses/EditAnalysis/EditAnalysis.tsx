import HelpIcon from '@mui/icons-material/Help';
import { Box, Button, Tooltip, Typography } from '@mui/material';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog/ConfirmationDialog';
import DisplayAnalysisWarnings from 'components/DisplayStudy/DisplayAnalyses/DisplayAnalysisWarnings/DisplayAnalysisWarnings';
import { useDeleteAnalysis } from 'pages/Studies/StudyStore';
import { useState } from 'react';
import EditAnalysisDetails from '../EditAnalysisDetails/EditAnalysisDetails';
import EditAnalysisPoints from '../EditAnalysisPoints/EditAnalysisPoints';

const EditAnalysis: React.FC<{ analysisId?: string; onDeleteAnalysis: () => void }> = (props) => {
    const deleteAnalysis = useDeleteAnalysis();

    const [dialogIsOpen, setDialogIsOpen] = useState(false);

    if (!props.analysisId) {
        return <Typography sx={{ color: 'warning.dark' }}>No analysis selected</Typography>;
    }

    const handleCloseDialog = (confirm?: boolean) => {
        if (confirm && props.analysisId) {
            deleteAnalysis(props.analysisId);
            props.onDeleteAnalysis();
        }
        setDialogIsOpen(false);
    };

    return (
        <Box sx={{ marginBottom: '2rem', width: '100%' }}>
            <DisplayAnalysisWarnings analysisId={props.analysisId} />
            <Box>
                <Typography sx={{ marginBottom: '1rem', fontWeight: 'bold' }}>
                    Analysis Details
                </Typography>
                <EditAnalysisDetails analysisId={props.analysisId} />
            </Box>

            <Box sx={{ marginTop: '2rem', width: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', margin: '0.5rem 0' }}>
                    <Typography sx={{ fontWeight: 'bold', marginRight: '1rem' }}>
                        Analysis Coordinates
                    </Typography>
                    <Tooltip
                        title="To add or remove rows, right click on a cell to open the context menu. You must enter all coordinates in order to save the overall study."
                        placement="right"
                    >
                        <HelpIcon color="primary" />
                    </Tooltip>
                </Box>
                <EditAnalysisPoints analysisId={props.analysisId} />
            </Box>
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
                <Button onClick={() => setDialogIsOpen(true)} variant="outlined" color="error">
                    Delete Analysis
                </Button>
            </Box>
        </Box>
    );
};

export default EditAnalysis;

import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import { Box, Button, Typography } from '@mui/material';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import useDeleteMetaAnalysis from 'hooks/metaAnalyses/useDeleteMetaAnalysis';
import useUserCanEdit from 'hooks/useUserCanEdit';
import { useSnackbar } from 'notistack';
import { useProjectUser } from 'pages/Project/store/ProjectStore';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const MetaAnalysisDangerZone: React.FC<{ metaAnalysisId: string | undefined }> = ({ metaAnalysisId }) => {
    const { projectId } = useParams<{ projectId: string }>();
    const projectUser = useProjectUser();
    const { mutate: deleteMetaAnalysis } = useDeleteMetaAnalysis();
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();

    const userCanEdit = useUserCanEdit(projectUser || undefined);

    const [confirmationDialogIsOpen, setConfirmationDialogIsOpen] = useState(false);

    const handleDeleteMetaAnalysis = (confirm?: boolean) => {
        if (confirm && !!metaAnalysisId) {
            deleteMetaAnalysis(metaAnalysisId, {
                onSuccess: () => {
                    enqueueSnackbar('Deleted Meta Analysis successfully', { variant: 'success' });
                    navigate(`/projects/${projectId}/meta-analyses`);
                },
            });
        }

        setConfirmationDialogIsOpen(false);
    };

    if (!userCanEdit) {
        return <></>;
    }

    return (
        <Box
            sx={{
                border: '1px solid',
                borderColor: 'error.main',
                borderRadius: '4px',
                padding: '1rem',
                marginTop: '2rem',
            }}
        >
            <Typography gutterBottom variant="h6" sx={{ color: 'error.main' }}>
                Danger zone
            </Typography>
            <ConfirmationDialog
                isOpen={confirmationDialogIsOpen}
                rejectText="Cancel"
                dialogTitle="Are you sure you want to delete the meta-analysis?"
                dialogMessage="This action cannot be undone"
                onCloseDialog={handleDeleteMetaAnalysis}
                confirmText="Confirm"
            />
            <Button
                startIcon={<ReportProblemIcon />}
                onClick={() => setConfirmationDialogIsOpen(true)}
                variant="contained"
                disableElevation
                color="error"
            >
                delete this meta-analysis
            </Button>
        </Box>
    );
};

export default MetaAnalysisDangerZone;

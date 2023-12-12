import { Box, Button, Typography } from '@mui/material';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog/ConfirmationDialog';
import useDeleteProject from 'hooks/projects/useDeleteProject';
import { useClearProvenance } from 'pages/Projects/ProjectPage/ProjectStore';
import { useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import { useSnackbar } from 'notistack';

const env = process.env.REACT_APP_ENV as 'DEV' | 'STAGING' | 'PROD';

const DangerZone: React.FC = (props) => {
    const { projectId }: { projectId: string } = useParams<{ projectId: string }>();
    const { mutate: deleteProject } = useDeleteProject();
    const clearProvenance = useClearProvenance();
    const history = useHistory();
    const { enqueueSnackbar } = useSnackbar();

    const [confirmationDialogIsOpen, setConfirmationDialogIsOpen] = useState(false);

    const handleDeleteProject = (confirm?: boolean) => {
        if (!projectId) return;

        if (confirm) {
            deleteProject(projectId, {
                onSuccess: () => {
                    enqueueSnackbar('Deleted project successfully', { variant: 'success' });
                    history.push('/projects');
                },
            });
        }

        setConfirmationDialogIsOpen(false);
    };

    return (
        <>
            {(env === 'DEV' || env === 'STAGING') && (
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
                        dialogTitle="Are you sure you want to delete the project?"
                        dialogMessage="This action cannot be undone"
                        onCloseDialog={handleDeleteProject}
                        confirmText="Confirm"
                    />
                    <Button
                        startIcon={<ReportProblemIcon />}
                        onClick={() => setConfirmationDialogIsOpen(true)}
                        variant="contained"
                        disableElevation
                        color="error"
                    >
                        delete this project
                    </Button>
                    <Box>
                        <Button
                            onClick={() => clearProvenance()}
                            variant="outlined"
                            sx={{ marginTop: '1rem' }}
                            color="error"
                        >
                            clear this project (FOR DEV PURPOSES)
                        </Button>
                    </Box>
                </Box>
            )}
        </>
    );
};

export default DangerZone;

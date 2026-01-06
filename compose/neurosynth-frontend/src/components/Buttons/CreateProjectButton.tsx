import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import LoadingButton from 'components/Buttons/LoadingButton';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import NavToolbarStyles from 'components/Navbar/NavToolbar.styles';
import { hasUnsavedChanges, unsetUnloadHandler } from 'helpers/BeforeUnload.helpers';
import { useCreateProject } from 'hooks';
import { generateNewProjectData } from 'pages/Project/store/ProjectStore.helpers';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const CreateProjectButton: React.FC = () => {
    const { mutate, isLoading: createProjectIsLoading } = useCreateProject();
    const navigate = useNavigate();
    const [confirmationDialogIsOpen, setConfirmationDialogIsOpen] = useState(false);

    const handleCreateProject = () => {
        mutate(generateNewProjectData('Untitled', ''), {
            onSuccess: (arg) => {
                navigate(`/projects/${arg.data.id || ''}`);
            },
        });
    };

    const handleButtonClick = () => {
        const unsavedChangesExist = hasUnsavedChanges();
        if (unsavedChangesExist) {
            setConfirmationDialogIsOpen(true);
            return;
        } else {
            handleCreateProject();
        }
    };

    const handleConfirmationDialogClose = (ok: boolean | undefined) => {
        if (ok) {
            unsetUnloadHandler('project');
            unsetUnloadHandler('study');
            unsetUnloadHandler('annotation');
            handleCreateProject();
        }
        setConfirmationDialogIsOpen(false);
    };

    return (
        <>
            <ConfirmationDialog
                dialogTitle="You have unsaved changes"
                dialogMessage="Are you sure you want to continue? You'll lose your unsaved changes"
                confirmText="Continue"
                rejectText="Cancel"
                onCloseDialog={handleConfirmationDialogClose}
                isOpen={confirmationDialogIsOpen}
            />
            <LoadingButton
                variant="contained"
                color="secondary"
                disableElevation
                loaderColor="primary"
                onClick={handleButtonClick}
                isLoading={createProjectIsLoading}
                sx={[NavToolbarStyles.menuItem, NavToolbarStyles.createProjectButton]}
                startIcon={<AddCircleOutlineIcon />}
                text="NEW PROJECT"
            />
        </>
    );
};

export default CreateProjectButton;

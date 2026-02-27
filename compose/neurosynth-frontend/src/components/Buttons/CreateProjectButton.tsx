import { useAuth0 } from '@auth0/auth0-react';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import LoadingButton from 'components/Buttons/LoadingButton';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import NavToolbarStyles from 'components/Navbar/NavToolbar.styles';
import { hasUnsavedChanges, unsetUnloadHandler } from 'helpers/BeforeUnload.helpers';
import { useCreateProject } from 'hooks';
import { ProjectSearchCriteria, projectsSearchHelper } from 'hooks/projects/useGetProjects';
import { generateNewProjectData, getNextUntitledProjectName } from 'pages/Project/store/ProjectStore.helpers';
import { useState } from 'react';
import { useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';

const projectSearchCriteria = new ProjectSearchCriteria(1, 1000);

const CreateProjectButton: React.FC = () => {
    const { mutate, isLoading: createProjectIsLoading } = useCreateProject();
    const navigate = useNavigate();
    const [confirmationDialogIsOpen, setConfirmationDialogIsOpen] = useState(false);
    const { user } = useAuth0();
    const [getProjectsIsLoading, setGetProjectsIsLoading] = useState(false);

    const handleCreateProject = async () => {
        try {
            setGetProjectsIsLoading(true);
            const userProjects = await projectsSearchHelper(projectSearchCriteria, user?.sub);
            const newProjectName = getNextUntitledProjectName(
                userProjects?.data?.results?.map((p) => p.name ?? '') ?? []
            );
            mutate(generateNewProjectData(newProjectName, ''), {
                onSuccess: (arg) => {
                    navigate(`/projects/${arg.data.id || ''}`);
                },
            });
        } catch (error) {
            console.error(error);
        } finally {
            setGetProjectsIsLoading(false);
        }
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
                isLoading={createProjectIsLoading || getProjectsIsLoading}
                sx={[NavToolbarStyles.menuItem, NavToolbarStyles.createProjectButton]}
                startIcon={<AddCircleOutlineIcon />}
                text="NEW PROJECT"
            />
        </>
    );
};

export default CreateProjectButton;

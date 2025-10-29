import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { ButtonGroup } from '@mui/material';
import LoadingButton from 'components/Buttons/LoadingButton';
import NavToolbarStyles from 'components/Navbar/NavToolbar.styles';
import { useCreateProject } from 'hooks';
import { generateNewProjectData } from 'pages/Project/store/ProjectStore.helpers';
import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const CreateProjectButton: React.FC = () => {
    const { mutate, isLoading: createProjectIsLoading } = useCreateProject();
    const navigate = useNavigate();
    const buttonGroupRef = useRef<HTMLDivElement>(null);

    const handleCreateProject = () => {
        mutate(generateNewProjectData('Untitled', ''), {
            onSuccess: (arg) => {
                navigate(`/projects/${arg.data.id || ''}`);
            },
        });
    };

    return (
        <ButtonGroup
            ref={buttonGroupRef}
            sx={{ marginRight: '8px' }}
            variant="contained"
            disableElevation
            color="secondary"
        >
            <LoadingButton
                variant="contained"
                loaderColor="primary"
                onClick={handleCreateProject}
                isLoading={createProjectIsLoading}
                sx={[NavToolbarStyles.menuItem, NavToolbarStyles.createProjectButton]}
                startIcon={<AddCircleOutlineIcon />}
                text="NEW PROJECT"
            />
        </ButtonGroup>
    );
};

export default CreateProjectButton;

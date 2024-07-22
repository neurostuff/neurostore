import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { ButtonGroup } from '@mui/material';
import NavToolbarStyles from 'components/Navbar/NavToolbar.styles';
import NeurosynthPopupMenu from 'components/NeurosynthPopupMenu';
import { useRef } from 'react';
import LoadingButton from 'components/Buttons/LoadingButton';
import { useCreateProject } from 'hooks';
import { generateNewProjectData } from 'pages/Project/store/ProjectStore.helpers';
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
        <>
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
                <NeurosynthPopupMenu
                    size="small"
                    anchorEl={buttonGroupRef.current}
                    buttonLabel={<ArrowDropDownIcon />}
                    options={[
                        {
                            label: 'Create project from sleuth file',
                            onClick: () => {
                                navigate('/projects/new/sleuth');
                            },
                            value: 'sleuth',
                        },
                    ]}
                />
            </ButtonGroup>
        </>
    );
};

export default CreateProjectButton;

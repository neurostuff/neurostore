import { useAuth0 } from '@auth0/auth0-react';
import LockIcon from '@mui/icons-material/Lock';
import PublicIcon from '@mui/icons-material/Public';
import { ToggleButtonGroup, ToggleButton, Box } from '@mui/material';
import useUserCanEdit from 'hooks/useUserCanEdit';
import { useProjectIsPublic, useProjectUser, useUpdateProjectIsPublic } from 'pages/Project/store/ProjectStore';

const ProjectEditPrivacyToggle: React.FC = () => {
    const updateProjectIsPublic = useUpdateProjectIsPublic();
    const isPublic = useProjectIsPublic();
    const user = useProjectUser();
    const userCanEdit = useUserCanEdit(user);

    if (!userCanEdit && isPublic) {
        return (
            <Box>
                <ToggleButton
                    selected
                    value="PUBLIC"
                    disabled
                    color="primary"
                    sx={{
                        borderRadius: '8px',
                        paddingLeft: '14px',
                        height: '30px',
                    }}
                >
                    Public <PublicIcon sx={{ marginLeft: '10px', fontSize: '20px' }} />
                </ToggleButton>
            </Box>
        );
    }

    if (!userCanEdit && !isPublic) {
        return (
            <Box>
                <ToggleButton
                    selected
                    value="PUBLIC"
                    disabled
                    color="primary"
                    sx={{
                        borderRadius: '8px',
                        paddingLeft: '14px',
                        height: '30px',
                    }}
                >
                    Private <LockIcon sx={{ marginLeft: '10px', fontSize: '20px' }} />
                </ToggleButton>
            </Box>
        );
    }

    return (
        <Box>
            <ToggleButtonGroup
                exclusive
                onChange={(event, newVal) => {
                    // do not update if newVal is the same as the current value or if it doesnt exist
                    if (newVal === null || newVal === isPublic) return;
                    updateProjectIsPublic(newVal === 'PUBLIC');
                }}
                color="primary"
                value={isPublic ? 'PUBLIC' : 'PRIVATE'}
                size="small"
            >
                <ToggleButton
                    value="PUBLIC"
                    sx={{
                        borderRadius: '8px',
                        paddingLeft: '14px',
                        height: '30px',
                    }}
                >
                    Public <PublicIcon sx={{ marginLeft: '10px', fontSize: '20px' }} />
                </ToggleButton>
                <ToggleButton
                    value="PRIVATE"
                    sx={{
                        borderRadius: '8px',
                        paddingLeft: '14px',
                        height: '30px',
                    }}
                >
                    Private <LockIcon sx={{ marginLeft: '10px', fontSize: '20px' }} />
                </ToggleButton>
            </ToggleButtonGroup>
        </Box>
    );
};

export default ProjectEditPrivacyToggle;

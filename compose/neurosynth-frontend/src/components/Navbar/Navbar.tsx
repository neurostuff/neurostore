import { useAuth0 } from '@auth0/auth0-react';
import { AppBar, Box } from '@mui/material';
import { EPropertyType } from 'components/EditMetadata';
import { useCreateProject } from 'hooks';
import { useHistory } from 'react-router-dom';
import NavDrawer from './NavDrawer/NavDrawer';
import NavToolbar from './NavToolbar/NavToolbar';
import NavbarStyles from './Navbar.styles';

export interface INav {
    onLogin: () => Promise<void>;
    onLogout: () => void;
    onCreateProject: (name: string, description: string) => void;
}

export const NAVBAR_HEIGHT = 64;

const Navbar: React.FC = (_props) => {
    const { loginWithPopup, logout } = useAuth0();
    const { mutate } = useCreateProject();
    const history = useHistory();

    const handleLogin = async () => {
        await loginWithPopup();
    };

    const handleLogout = () => logout({ returnTo: window.location.origin });

    const handleCreateProject = (name: string, description: string) => {
        mutate(
            {
                name,
                description,
                provenance: {
                    curationMetadata: {
                        columns: [],
                        prismaConfig: {
                            isPrisma: false,
                            identification: {
                                exclusionTags: [],
                            },
                            screening: {
                                exclusionTags: [],
                            },
                            eligibility: {
                                exclusionTags: [],
                            },
                        },
                        infoTags: [],
                        exclusionTags: [],
                        identificationSources: [],
                    },
                    extractionMetadata: {
                        studysetId: null,
                        annotationId: null,
                        studyStatusList: [],
                    },
                    selectionMetadata: {
                        filter: {
                            selectionKey: null,
                            type: EPropertyType.NONE,
                        },
                    },
                    algorithmMetadata: {
                        specificationId: null,
                    },
                },
            },
            {
                onSuccess: (arg) => {
                    history.push(`/projects/${arg.data.id || ''}`);
                },
            }
        );
    };

    return (
        // declare size as this is used to calculate height of other views such as the curation board
        <AppBar sx={{ height: `${NAVBAR_HEIGHT}px` }} position="static" elevation={0}>
            <Box sx={NavbarStyles.mdUp}>
                <NavToolbar
                    onCreateProject={handleCreateProject}
                    onLogin={handleLogin}
                    onLogout={handleLogout}
                />
            </Box>
            <Box sx={NavbarStyles.mdDown}>
                <NavDrawer
                    onCreateProject={handleCreateProject}
                    onLogin={handleLogin}
                    onLogout={handleLogout}
                />
            </Box>
        </AppBar>
    );
};

export default Navbar;

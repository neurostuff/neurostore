import { AppBar, Box } from '@mui/material';
import { useAuth0 } from '@auth0/auth0-react';
import NavToolbar from './NavToolbar/NavToolbar';
import NavDrawer from './NavDrawer/NavDrawer';
import NavbarStyles from './Navbar.styles';
import useCreateProject from 'hooks/requests/useCreateProject';

export interface INav {
    onLogin: () => Promise<void>;
    onLogout: () => void;
    onCreateProject: (name: string, description: string) => void;
}

const Navbar: React.FC = (_props) => {
    const { loginWithPopup, logout } = useAuth0();
    const { mutate } = useCreateProject();

    const handleLogin = async () => {
        await loginWithPopup();
    };

    const handleLogout = () => logout({ returnTo: window.location.origin });

    const handleCreateProject = (name: string, description: string) => {
        mutate({ name, description });
    };

    return (
        <AppBar position="static" elevation={0}>
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

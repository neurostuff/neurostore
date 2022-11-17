import { AppBar, Box } from '@mui/material';
import { useAuth0 } from '@auth0/auth0-react';
import NavToolbar from './NavToolbar/NavToolbar';
import NavDrawer from './NavDrawer/NavDrawer';
import NavbarStyles from './Navbar.styles';

const Navbar: React.FC = (_props) => {
    const { loginWithPopup, logout } = useAuth0();

    const handleLogin = async () => {
        await loginWithPopup();
    };

    const handleLogout = () => logout({ returnTo: window.location.origin });

    return (
        <AppBar position="static" elevation={0}>
            <Box sx={NavbarStyles.mdUp}>
                <NavToolbar login={handleLogin} logout={handleLogout} />
            </Box>
            <Box sx={NavbarStyles.mdDown}>
                <NavDrawer login={handleLogin} logout={handleLogout} />
            </Box>
        </AppBar>
    );
};

export default Navbar;

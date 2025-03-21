import { useAuth0 } from '@auth0/auth0-react';
import { AppBar, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import NavDrawer from 'components/Navbar/NavDrawer';
import NavToolbar from 'components/Navbar/NavToolbar';
import NavbarStyles from 'components/Navbar/Navbar.styles';

export interface INav {
    onLogin: () => Promise<void>;
    onLogout: () => void;
}

export const NAVBAR_HEIGHT = 64;
const AUTH0_AUDIENCE = import.meta.env.VITE_APP_AUTH0_AUDIENCE;

const Navbar: React.FC = (_props) => {
    const navigate = useNavigate();
    const { loginWithPopup, logout } = useAuth0();
    const handleLogin = async () => {
        await loginWithPopup({
            audience: AUTH0_AUDIENCE,
            scope: 'openid profile email offline_access',
        });

        if (window.gtag) {
            window.gtag('event', 'login');
        }

        navigate('/');
    };

    const handleLogout = () => logout({ returnTo: window.location.origin });

    return (
        // declare size as this is used to calculate height of other views such as the curation board
        <AppBar sx={{ height: `${NAVBAR_HEIGHT}px` }} position="static" elevation={0}>
            <Box sx={NavbarStyles.mdUp}>
                <NavToolbar onLogin={handleLogin} onLogout={handleLogout} />
            </Box>
            <Box sx={NavbarStyles.mdDown}>
                <NavDrawer onLogin={handleLogin} onLogout={handleLogout} />
            </Box>
        </AppBar>
    );
};

export default Navbar;

import { AppBar, Box } from '@mui/material';
import NavDrawer from 'components/Navbar/NavDrawer';
import NavToolbar from 'components/Navbar/NavToolbar';
import NavbarStyles from 'components/Navbar/Navbar.styles';
import useAuthenticate from 'hooks/useAuthenticate';

export interface INav {
    onLogin: () => Promise<void>;
    onLogout: () => void;
}

export const NAVBAR_HEIGHT = 64;

const Navbar: React.FC = () => {
    const { handleLogin, handleLogout } = useAuthenticate();

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

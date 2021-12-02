import { AppBar, Toolbar, Hidden } from '@mui/material';
import NavbarStyles from './Navbar.styles';
import NavbarDrawer from './NavbarDrawer/NavbarDrawer';
import NavbarToolbar from './NavbarToolbar/NavbarToolbar';
import { useAuth0 } from '@auth0/auth0-react';
import { useContext } from 'react';
import { GlobalContext } from '../../contexts/GlobalContext';
import { NavOptionsModel } from '.';

const navItems: NavOptionsModel[] = [
    { label: 'Home', path: '/', authenticationRequired: false },
    { label: 'Studies', path: '/studies', authenticationRequired: false },
    // { label: 'My Cloned Studies', path: '/clonedStudies', authenticationRequired: true },
    { label: 'Datasets', path: '/datasets', authenticationRequired: false },
];

const Navbar = () => {
    const context = useContext(GlobalContext);
    const { loginWithPopup, getAccessTokenSilently, logout } = useAuth0();

    const handleLogin = async () => {
        try {
            await loginWithPopup();
            const accessToken = await getAccessTokenSilently();
            context?.handleToken(accessToken);
        } catch (exception) {
            console.error(exception);
        }
    };

    const handleLogout = () => logout({ returnTo: window.location.origin });

    return (
        <AppBar position="static" elevation={0}>
            <Hidden mdDown>
                <Toolbar sx={NavbarStyles.toolbar}>
                    <NavbarToolbar
                        logout={handleLogout}
                        login={handleLogin}
                        navOptions={navItems}
                    />
                </Toolbar>
            </Hidden>
            <Hidden mdUp>
                <Toolbar sx={NavbarStyles.toolbar}>
                    <NavbarDrawer logout={handleLogout} login={handleLogin} navOptions={navItems} />
                </Toolbar>
            </Hidden>
        </AppBar>
    );
};

export default Navbar;

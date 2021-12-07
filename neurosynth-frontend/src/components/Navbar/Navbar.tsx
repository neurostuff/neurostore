import { AppBar, Toolbar, Hidden } from '@mui/material';
import NavbarStyles from './Navbar.styles';
import NavbarDrawer from './NavbarDrawer/NavbarDrawer';
import NavbarToolbar from './NavbarToolbar/NavbarToolbar';
import { useAuth0 } from '@auth0/auth0-react';
import { useContext } from 'react';
import { GlobalContext } from '../../contexts/GlobalContext';
import { NavOptionsModel } from '.';

const navItems: NavOptionsModel[] = [
    { label: 'HOME', path: '/', children: null },
    {
        label: 'STUDIES',
        path: '',
        children: [
            { label: 'Public Studies', path: '/studies', children: null },
            {
                label: 'My Cloned Studies',
                path: '/studies/userclonedstudies',
                children: null,
                authenticationRequired: true,
            },
        ],
    },
    {
        label: 'DATASETS',
        path: '',
        children: [
            { label: 'Public Datasets', path: '/datasets', children: null },
            {
                label: 'My Datasets',
                path: '/datasets/userdatasets',
                children: null,
                authenticationRequired: true,
            },
        ],
    },
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

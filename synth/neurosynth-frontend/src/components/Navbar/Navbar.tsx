import { AppBar } from '@mui/material';
import NavbarDrawer from './NavbarDrawer/NavbarDrawer';
import NavbarToolbar from './NavbarToolbar/NavbarToolbar';
import { useAuth0 } from '@auth0/auth0-react';
import { NavOptionsModel } from '.';
import API from '../../utils/api';

const navItems: NavOptionsModel[] = [
    { label: 'HOME', path: '/', children: null },
    {
        label: 'STUDIES',
        path: '',
        disabled: false,
        authenticationRequired: false,
        children: [
            { label: 'Public Studies', path: '/studies', children: null },
            {
                label: 'My Studies',
                path: '/studies/userclonedstudies',
                children: null,
                authenticationRequired: true,
            },
        ],
    },
    {
        label: 'DATASETS',
        path: '',
        disabled: false,
        authenticationRequired: false,
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
    const { loginWithPopup, getAccessTokenSilently, logout } = useAuth0();

    const handleLogin = async () => {
        try {
            await loginWithPopup();
            const token = await getAccessTokenSilently();
            API.UpdateServicesWithToken(token);
        } catch (exception) {
            console.error(exception);
        }
    };

    const handleLogout = () => logout({ returnTo: window.location.origin });

    return (
        <AppBar position="static" elevation={0}>
            <NavbarToolbar logout={handleLogout} login={handleLogin} navOptions={navItems} />
            <NavbarDrawer logout={handleLogout} login={handleLogin} navOptions={navItems} />
        </AppBar>
    );
};

export default Navbar;

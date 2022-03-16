import { AppBar } from '@mui/material';
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
        disabled: false,
        authenticationRequired: false,
        children: [
            { label: 'Public Studies', path: '/studies', children: null },
            {
                label: 'My Studies',
                path: '/userclonedstudies',
                children: null,
                authenticationRequired: true,
            },
        ],
    },
    {
        label: 'STUDYSETS',
        path: '',
        disabled: false,
        authenticationRequired: false,
        children: [
            { label: 'Public Studysets', path: '/studysets', children: null },
            {
                label: 'My Studysets',
                path: '/userstudysets',
                children: null,
                authenticationRequired: true,
            },
        ],
    },
    {
        label: 'META-ANALYSES',
        path: '',
        disabled: false,
        authenticationRequired: false,
        children: [
            { label: 'Public Meta-Analyses', path: '/meta-analyses', children: null },
            {
                label: 'My Meta-Analyses',
                path: '/usermeta-analyses',
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
            <NavbarToolbar logout={handleLogout} login={handleLogin} navOptions={navItems} />
            <NavbarDrawer logout={handleLogout} login={handleLogin} navOptions={navItems} />
        </AppBar>
    );
};

export default Navbar;

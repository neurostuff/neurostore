import { AppBar } from '@mui/material';
import NavbarToolbar from './NavbarToolbar/NavbarToolbar';
import { useAuth0 } from '@auth0/auth0-react';
import { NavOptionsModel } from '.';

const authenticatedNavItems: NavOptionsModel[] = [
    { label: 'HOME', path: '/', children: null },
    {
        label: 'STUDIES',
        path: '',
        disabled: false,
        className: 'tour-studies-tab',
        authenticationRequired: false,
        children: [
            {
                label: 'Public Studies',
                path: '/studies',
                children: null,
            },
            {
                label: 'My Studies',
                path: '/userstudies',
                children: null,
                authenticationRequired: true,
            },
        ],
    },
    {
        label: 'STUDYSETS',
        path: '',
        className: 'tour-studysets-tab',
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
        className: 'tour-meta-analyses-tab',
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
            {
                label: 'Create New Meta-Analysis',
                path: '/meta-analyses/build',
                children: null,
                authenticationRequired: true,
            },
        ],
    },
];

const nonAuthenticatedNavItems: NavOptionsModel[] = [
    {
        label: 'HOME',
        path: '/',
        children: null,
    },
    {
        label: 'STUDIES',
        path: '/studies',
        children: null,
    },
    {
        label: 'STUDYSETS',
        path: '/studysets',
        children: null,
    },
    {
        label: 'META-ANALYSES',
        path: '/meta-analyses',
        children: null,
    },
];

const Navbar: React.FC = (_props) => {
    const { loginWithPopup, logout, isAuthenticated } = useAuth0();

    const handleLogin = async () => {
        await loginWithPopup();
    };

    const handleLogout = () => logout({ returnTo: window.location.origin });

    return (
        <AppBar position="static" elevation={0}>
            <NavbarToolbar
                logout={handleLogout}
                login={handleLogin}
                navOptions={isAuthenticated ? authenticatedNavItems : nonAuthenticatedNavItems}
            />
        </AppBar>
    );
};

export default Navbar;

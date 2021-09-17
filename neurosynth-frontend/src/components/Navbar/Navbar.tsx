import { AppBar, Toolbar, Hidden } from '@material-ui/core';
import NavbarStyles from './NavbarStyles';
import NavbarDrawer from './NavbarDrawer/NavbarDrawer';
import NavbarToolbar from './NavbarToolbar/NavbarToolbar';
import { useAuth0 } from '@auth0/auth0-react';
import { useContext } from 'react';
import { GlobalContext } from '../../contexts/GlobalContext';

export interface NavOptionsModel {
    label: string;
    path: string;
}

export interface NavbarArgs {
    navOptions: NavOptionsModel[];
    login: () => void;
    logout: () => void;
}

const navItems: NavOptionsModel[] = [
    { label: 'Home', path: '/' },
    { label: 'Studies', path: '/studies' },
];

const Navbar = () => {
    const classes = NavbarStyles();
    const context = useContext(GlobalContext);
    const { loginWithPopup, getAccessTokenSilently, logout } = useAuth0();

    const handleLogin = async () => {
        try {
            await loginWithPopup();
            const accessToken = await getAccessTokenSilently();
            context?.updateToken(accessToken);
        } catch (exception) {
            console.log(exception);
        }
    };

    const handleLogout = () => logout();

    return (
        <AppBar position="static" elevation={0}>
            <Hidden smDown>
                <Toolbar className={classes.toolbar}>
                    <NavbarToolbar
                        logout={handleLogout}
                        login={handleLogin}
                        navOptions={navItems}
                    />
                </Toolbar>
            </Hidden>
            <Hidden mdUp>
                <Toolbar className={classes.toolbar}>
                    <NavbarDrawer logout={handleLogout} login={handleLogin} navOptions={navItems} />
                </Toolbar>
            </Hidden>
        </AppBar>
    );
};

export default Navbar;

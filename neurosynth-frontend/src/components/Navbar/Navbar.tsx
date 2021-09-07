import { NavLink } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, Hidden } from '@material-ui/core';
import NavbarStyles from './NavbarStyles';
import { useAuth0 } from '@auth0/auth0-react';
import NavbarDrawer from './NavbarDrawer/NavbarDrawer';
import API from '../../utils/api';

export interface NavOptionsModel {
    label: string;
    path: string;
}

const navItems: NavOptionsModel[] = [
    { label: 'Home', path: '/' },
    { label: 'Studies', path: '/studies' },
];

const Navbar = () => {
    const classes = NavbarStyles();
    const { loginWithPopup, logout, isAuthenticated, getAccessTokenSilently } = useAuth0();

    const login = async () => {
        try {
            await loginWithPopup();
            const accessToken = await getAccessTokenSilently();
            console.log(accessToken);

            API.UpdateServicesWithToken(accessToken);
        } catch (exception) {
            console.log(exception);
        }
    };

    return (
        <AppBar position="static" elevation={0}>
            <Hidden smDown>
                <Toolbar className={classes.toolbar}>
                    <div>
                        <Typography variant="h5">neurosynth</Typography>
                    </div>
                    <div className={classes.navLinksContainer}>
                        {navItems.map((navItem, index) => (
                            <Button key={index} className={classes.button}>
                                <NavLink
                                    className={classes.link}
                                    activeClassName={classes.active}
                                    exact
                                    to={navItem.path}
                                >
                                    {navItem.label}
                                </NavLink>
                            </Button>
                        ))}
                        {!isAuthenticated && (
                            <Button className={classes.button} onClick={() => login()}>
                                <span className={classes.link}>Login</span>
                            </Button>
                        )}
                        {isAuthenticated && (
                            <Button className={classes.button} onClick={() => logout()}>
                                <span className={classes.link}>Logout</span>
                            </Button>
                        )}
                    </div>
                </Toolbar>
            </Hidden>
            <Hidden mdUp>
                <Toolbar className={classes.toolbar}>
                    <NavbarDrawer navOptions={navItems} />
                </Toolbar>
            </Hidden>
        </AppBar>
    );
};

export default Navbar;

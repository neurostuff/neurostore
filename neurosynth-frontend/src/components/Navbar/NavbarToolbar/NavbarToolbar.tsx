import { useAuth0 } from '@auth0/auth0-react';
import { Button, Typography } from '@material-ui/core';
import { NavLink } from 'react-router-dom';
import { NavbarArgs } from '../Navbar';
import NavbarToolbarStyles from './NavbarToolbarStyles';

const NavbarToolbar: React.FC<NavbarArgs> = (props) => {
    const classes = NavbarToolbarStyles();
    const { isAuthenticated } = useAuth0();

    return (
        <>
            <Typography variant="h5">neurosynth</Typography>
            <div className={classes.navLinksContainer}>
                {props.navOptions.map((navItem, index) => (
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
                    <Button className={classes.button} onClick={props.login}>
                        <span className={classes.link}>Login</span>
                    </Button>
                )}
                {isAuthenticated && (
                    <Button className={classes.button} onClick={props.logout}>
                        <span className={classes.link}>Logout</span>
                    </Button>
                )}
            </div>
        </>
    );
};

export default NavbarToolbar;

import { NavLink } from 'react-router-dom';
import { Typography, IconButton, Drawer, List, ListItem, ListItemText } from '@material-ui/core';
import { useState } from 'react';
import MenuIcon from '@material-ui/icons/Menu';
import { NavOptionsModel } from '../Navbar';
import NavbarDrawerStyles from './NavbarDrawerStyles';
import { useAuth0 } from '@auth0/auth0-react';

const NavbarDrawer: React.FC<{ navOptions: NavOptionsModel[] }> = (props) => {
    const [drawerIsOpen, setDrawerIsOpen] = useState(false);
    const classes = NavbarDrawerStyles();
    const { loginWithPopup, logout, isAuthenticated } = useAuth0();
    const toggleDrawer = () => {
        setDrawerIsOpen((prevState) => !prevState);
    };

    return (
        <>
            <Typography variant="h5">neurosynth</Typography>
            <Drawer anchor="left" open={drawerIsOpen} onClose={toggleDrawer}>
                <List className={classes.list}>
                    {props.navOptions.map((navItem, index) => (
                        <ListItem button key={index} component={NavLink} to={navItem.path} onClick={toggleDrawer}>
                            <ListItemText primary={navItem.label} />
                        </ListItem>
                    ))}
                    {!isAuthenticated && (
                        <ListItem
                            button
                            onClick={() => {
                                loginWithPopup();
                            }}
                        >
                            <ListItemText primary="Login"></ListItemText>
                        </ListItem>
                    )}
                    {isAuthenticated && (
                        <ListItem
                            button
                            onClick={() => {
                                logout();
                            }}
                        >
                            <ListItemText primary="Logout"></ListItemText>
                        </ListItem>
                    )}
                </List>
            </Drawer>
            <IconButton onClick={toggleDrawer} size="medium">
                <MenuIcon />
            </IconButton>
        </>
    );
};

export default NavbarDrawer;

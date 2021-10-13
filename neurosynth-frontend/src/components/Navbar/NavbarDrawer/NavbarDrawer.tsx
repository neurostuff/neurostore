import { NavLink } from 'react-router-dom';
import { Typography, IconButton, Drawer, List, ListItem, ListItemText } from '@mui/material';
import { useState } from 'react';
import MenuIcon from '@mui/icons-material/Menu';
import NavbarDrawerStyles from './NavbarDrawerStyles';
import { useAuth0 } from '@auth0/auth0-react';
import { NavbarArgs } from '..';

const NavbarDrawer: React.FC<NavbarArgs> = (props) => {
    const [drawerIsOpen, setDrawerIsOpen] = useState(false);
    const classes = NavbarDrawerStyles();
    const { isAuthenticated } = useAuth0();
    const toggleDrawer = () => {
        setDrawerIsOpen((prevState) => !prevState);
    };

    return (
        <>
            <Typography variant="h5">neurosynth</Typography>
            <Drawer anchor="left" open={drawerIsOpen} onClose={toggleDrawer}>
                <List className={classes.list}>
                    {props.navOptions.map((navItem, index) => (
                        <ListItem
                            button
                            key={index}
                            component={NavLink}
                            to={navItem.path}
                            onClick={toggleDrawer}
                        >
                            <ListItemText primary={navItem.label} />
                        </ListItem>
                    ))}
                    {!isAuthenticated && (
                        <ListItem button onClick={props.login}>
                            <ListItemText primary="Login"></ListItemText>
                        </ListItem>
                    )}
                    {isAuthenticated && (
                        <ListItem button onClick={props.logout}>
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

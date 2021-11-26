import { NavLink } from 'react-router-dom';
import {
    Typography,
    IconButton,
    Drawer,
    List,
    ListItem,
    ListItemText,
    Button,
    Box,
    Badge,
} from '@mui/material';
import { useState } from 'react';
import MenuIcon from '@mui/icons-material/Menu';
import { useAuth0 } from '@auth0/auth0-react';
import { NavbarArgs } from '..';
import NavbarStyles from '../Navbar.styles';

const NavbarDrawer: React.FC<NavbarArgs> = (props) => {
    const [drawerIsOpen, setDrawerIsOpen] = useState(false);
    const { isAuthenticated } = useAuth0();
    const toggleDrawer = () => {
        setDrawerIsOpen((prevState) => !prevState);
    };

    return (
        <>
            <Button>
                <Box to="/" exact sx={NavbarStyles.neurosynthLink} component={NavLink}>
                    <Typography variant="h5">
                        <Badge color="secondary" badgeContent={<span>alpha</span>}>
                            neurosynth
                        </Badge>
                    </Typography>
                </Box>
            </Button>
            <Drawer anchor="left" open={drawerIsOpen} onClose={toggleDrawer}>
                <List sx={{ width: '240px' }}>
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

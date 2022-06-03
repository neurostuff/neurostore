import { NavLink } from 'react-router-dom';
import {
    Typography,
    IconButton,
    Drawer,
    List,
    ListItem,
    Button,
    Box,
    Badge,
    Toolbar,
} from '@mui/material';
import { useState } from 'react';
import MenuIcon from '@mui/icons-material/Menu';
import NavbarPopupMenu from '../NavbarPopupMenu/NavbarPopupMenu';
import { NavbarArgs } from '..';
import NavbarStyles from '../Navbar.styles';
import NavbarDrawerStyles from './NavbarDrawer.styles';
import { useAuth0 } from '@auth0/auth0-react';

const NavbarDrawer: React.FC<NavbarArgs> = (props) => {
    const [drawerIsOpen, setDrawerIsOpen] = useState(false);
    const { isAuthenticated } = useAuth0();
    const toggleDrawer = () => {
        setDrawerIsOpen((prevState) => !prevState);
    };

    return (
        <Toolbar sx={[NavbarStyles.toolbar, NavbarStyles.mdDown]}>
            <Box style={{ display: 'flex', alignItems: 'center' }}>
                <img
                    alt="neurosynth compose logo"
                    style={{
                        width: '65px',
                        height: '65px',
                        marginRight: '1rem',
                        cursor: 'pointer',
                    }}
                    src="/static/synth.png"
                />
                <Box to="/" exact sx={NavbarStyles.neurosynthLink} component={NavLink}>
                    <Typography variant="h5">
                        <Badge color="warning" badgeContent={<span>beta</span>}>
                            neurosynth compose
                        </Badge>
                    </Typography>
                </Box>
            </Box>
            <Drawer anchor="left" open={drawerIsOpen} onClose={toggleDrawer}>
                <List sx={NavbarDrawerStyles.list}>
                    {props.navOptions.map((navOption) => (
                        <ListItem sx={NavbarDrawerStyles.listItem} key={navOption.label}>
                            <NavbarPopupMenu
                                navOption={navOption}
                                menuPosition={{
                                    vertical: 'top',
                                    horizontal: 'right',
                                }}
                                styling={{
                                    ...NavbarDrawerStyles.buttonOverride,
                                    ...NavbarDrawerStyles.innerButtonOverride,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                }}
                            />
                        </ListItem>
                    ))}
                    <ListItem sx={NavbarDrawerStyles.listItem}>
                        <Button
                            sx={[
                                NavbarDrawerStyles.buttonOverride,
                                NavbarDrawerStyles.innerButtonOverride,
                                isAuthenticated ? {} : { color: 'warning.dark' },
                            ]}
                            onClick={isAuthenticated ? props.logout : props.login}
                        >
                            <Box component="span">
                                {isAuthenticated ? 'Logout' : 'Sign in/Sign up'}
                            </Box>
                        </Button>
                    </ListItem>
                </List>
            </Drawer>
            <IconButton onClick={toggleDrawer} size="medium">
                <MenuIcon />
            </IconButton>
        </Toolbar>
    );
};

export default NavbarDrawer;

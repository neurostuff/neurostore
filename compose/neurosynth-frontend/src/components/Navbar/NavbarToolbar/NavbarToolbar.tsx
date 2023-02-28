import { useAuth0 } from '@auth0/auth0-react';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
    Box,
    Button,
    Typography,
    Badge,
    Toolbar,
    IconButton,
    Drawer,
    List,
    ListItem,
    Link,
} from '@mui/material';
import { NavLink } from 'react-router-dom';
import { NavbarArgs } from '..';
import NavbarStyles from '../Navbar.styles';
import NavbarToolbarStyles from './NavbarToolbar.styles';
import NavbarPopupMenu from '../NavbarPopupMenu/NavbarPopupMenu';
import React, { useState } from 'react';
import MenuIcon from '@mui/icons-material/Menu';
import NavbarPopupMenuStyles from '../NavbarPopupMenu/NavbarPopupMenu.styles';

const NavbarToolbar: React.FC<NavbarArgs> = (props) => {
    const { isAuthenticated } = useAuth0();

    const [drawerIsOpen, setDrawerIsOpen] = useState(false);
    const toggleDrawer = () => {
        setDrawerIsOpen((prevState) => !prevState);
    };

    return (
        <Toolbar sx={[NavbarStyles.toolbar]}>
            <Box
                sx={[NavbarToolbarStyles.neurosynthLink, { display: 'flex', alignItems: 'center' }]}
                component={NavLink}
                to="/"
            >
                <img
                    alt="neurosynth compose logo"
                    style={{
                        width: '45px',
                        height: '45px',
                        marginRight: '0.75rem',
                        cursor: 'pointer',
                    }}
                    src="/static/synth.png"
                />
                <Badge
                    color="warning"
                    badgeContent={<Typography variant="caption">beta</Typography>}
                >
                    <Typography sx={NavbarToolbarStyles.logoText}>neurosynth compose</Typography>
                </Badge>
            </Box>
            <Box sx={[NavbarToolbarStyles.navLinksContainer, NavbarStyles.mdUp]}>
                {props.navOptions.map((navOption) => (
                    <NavbarPopupMenu
                        key={navOption.label}
                        navOption={navOption}
                        menuPosition={{ vertical: 'bottom', horizontal: 'left' }}
                        styling={{
                            ...NavbarToolbarStyles.button,
                            padding: '0px 8px',
                            color: 'primary.contrastText',
                        }}
                    />
                ))}
                <Button
                    sx={NavbarToolbarStyles.button}
                    onClick={isAuthenticated ? props.logout : props.login}
                >
                    <Typography
                        variant="subtitle2"
                        sx={[
                            NavbarToolbarStyles.link,
                            isAuthenticated ? {} : { color: 'warning.main' },
                            NavbarPopupMenuStyles.button,
                        ]}
                    >
                        {isAuthenticated ? 'Logout' : 'Sign in/Sign up'}
                    </Typography>
                </Button>
                <Link
                    sx={[
                        NavbarToolbarStyles.button,
                        { borderRadius: '4px', textDecoration: 'none' },
                    ]}
                    target="_blank"
                    href="https://neurostuff.github.io/neurostore/"
                >
                    <Typography
                        data-tour="AuthenticatedLandingPage-2"
                        variant="subtitle2"
                        sx={[NavbarToolbarStyles.link, NavbarPopupMenuStyles.button]}
                    >
                        HELP
                        <OpenInNewIcon sx={{ marginLeft: '8px', fontSize: '1.2rem' }} />
                    </Typography>
                </Link>
            </Box>
            <IconButton sx={NavbarStyles.mdDown} onClick={toggleDrawer} size="medium">
                <MenuIcon />
            </IconButton>
            <Drawer anchor="right" open={drawerIsOpen} onClose={toggleDrawer}>
                <List sx={NavbarToolbarStyles.list}>
                    {props.navOptions.map((navOption) => (
                        <ListItem sx={NavbarToolbarStyles.listItem} key={navOption.label}>
                            <NavbarPopupMenu
                                navOption={navOption}
                                menuPosition={{
                                    vertical: 'top',
                                    horizontal: 'right',
                                }}
                                styling={{
                                    ...NavbarToolbarStyles.buttonOverride,
                                    ...NavbarToolbarStyles.innerButtonOverride,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                }}
                            />
                        </ListItem>
                    ))}
                    <ListItem sx={NavbarToolbarStyles.listItem}>
                        <Button
                            sx={[
                                NavbarToolbarStyles.buttonOverride,
                                NavbarToolbarStyles.innerButtonOverride,
                                isAuthenticated ? {} : { color: 'warning.dark' },
                            ]}
                            onClick={isAuthenticated ? props.logout : props.login}
                        >
                            <Typography>
                                {isAuthenticated ? 'Logout' : 'Sign in/Sign up'}
                            </Typography>
                        </Button>
                    </ListItem>
                    <ListItem sx={NavbarToolbarStyles.listItem}>
                        <Button
                            sx={[
                                NavbarToolbarStyles.buttonOverride,
                                NavbarToolbarStyles.innerButtonOverride,
                            ]}
                        >
                            <Link
                                sx={{ textDecoration: 'none', color: 'black', width: '100%' }}
                                target="_blank"
                                href="https://neurostuff.github.io/neurostore/"
                            >
                                <Typography sx={{ display: 'flex' }}>
                                    HELP
                                    <OpenInNewIcon sx={{ marginLeft: '8px' }} />
                                </Typography>
                            </Link>
                        </Button>
                    </ListItem>
                </List>
            </Drawer>
        </Toolbar>
    );
};

export default NavbarToolbar;
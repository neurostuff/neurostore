import { useAuth0 } from '@auth0/auth0-react';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import MenuIcon from '@mui/icons-material/Menu';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
    Box,
    Button,
    Drawer,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Toolbar,
    Typography,
} from '@mui/material';
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import DrawerToggleMenu from '../NavSubMenu/DrawerToggleSubMenu';
import { INav } from '../Navbar';
import NavbarStyles from '../Navbar.styles';

const NavDrawer: React.FC<INav> = (props) => {
    const { isAuthenticated } = useAuth0();
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();

    const handleOpenDrawer = (_event: React.MouseEvent<HTMLElement>) => {
        setIsOpen(true);
    };

    const handleCloseDrawer = (_event: React.MouseEvent) => {
        setIsOpen(false);
    };

    return (
        <Toolbar>
            <Box
                component={NavLink}
                to="/"
                sx={[NavbarStyles.logoContainer, { flexGrow: 1, justifyContent: 'flex-end' }]}
            >
                <img
                    style={NavbarStyles.logo as any}
                    alt="neurosynth compose logo"
                    src="/static/synth.png"
                />
                <Typography sx={NavbarStyles.logoText}>neurosynth compose</Typography>
            </Box>
            <Box sx={{ flexGrow: 1, justifyContent: 'flex-end', display: 'flex' }}>
                <IconButton onClick={handleOpenDrawer}>
                    <MenuIcon />
                </IconButton>
            </Box>
            <Drawer anchor="right" open={isOpen} onClose={handleCloseDrawer}>
                <List>
                    {isAuthenticated && (
                        <>
                            <ListItem>
                                <ListItemButton>
                                    <ListItemIcon>
                                        <AddCircleOutlineIcon color="secondary" />
                                    </ListItemIcon>
                                    <ListItemText
                                        sx={{ color: 'secondary.main' }}
                                        primary="NEW PROJECT"
                                    />
                                </ListItemButton>
                            </ListItem>
                            <ListItem>
                                <ListItemButton onClick={() => navigate('/projects')}>
                                    <ListItemIcon />
                                    <ListItemText primary="MY PROJECTS" />
                                </ListItemButton>
                            </ListItem>
                        </>
                    )}
                    <DrawerToggleMenu labelText="EXPLORE">
                        <List>
                            <ListItem>
                                <ListItemButton onClick={() => navigate('/base-studies')}>
                                    <ListItemIcon />
                                    <ListItemText primary="STUDIES" />
                                </ListItemButton>
                            </ListItem>
                            <ListItem>
                                <ListItemButton onClick={() => navigate('/meta-analyses')}>
                                    <ListItemIcon />
                                    <ListItemText primary="META-ANALYSES" />
                                </ListItemButton>
                            </ListItem>
                        </List>
                    </DrawerToggleMenu>
                    <ListItem>
                        <Button
                            sx={{ display: 'flex', padding: '8px 16px', width: '100%' }}
                            target="_blank"
                            rel="noreferrer"
                            href="https://neurostuff.github.io/neurostore/"
                        >
                            <ListItemIcon>
                                <OpenInNewIcon />
                            </ListItemIcon>
                            <ListItemText primary="DOCS" sx={{ color: 'black' }} />
                        </Button>
                    </ListItem>
                    <ListItem>
                        <ListItemButton
                            onClick={() => {
                                isAuthenticated ? props.onLogout() : props.onLogin();
                            }}
                        >
                            <ListItemIcon />
                            <ListItemText
                                sx={{
                                    color: isAuthenticated ? '' : 'warning.dark',
                                }}
                                primary={isAuthenticated ? 'LOGOUT' : 'SIGN IN/SIGN UP'}
                            />
                        </ListItemButton>
                    </ListItem>
                </List>
            </Drawer>
        </Toolbar>
    );
};

export default NavDrawer;

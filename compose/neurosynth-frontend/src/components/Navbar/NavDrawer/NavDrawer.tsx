import {
    Box,
    Typography,
    Badge,
    Toolbar,
    IconButton,
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import NavbarStyles from '../Navbar.styles';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DrawerToggleMenu from '../NavSubMenu/DrawerToggleSubMenu';
import { useAuth0 } from '@auth0/auth0-react';

const NavDrawer: React.FC = (props) => {
    const { isAuthenticated } = useAuth0();
    const [isOpen, setIsOpen] = useState(false);

    const handleOpenDrawer = (event: React.MouseEvent<HTMLElement>) => {
        setIsOpen(true);
    };

    const handleCloseDrawer = (event: React.MouseEvent) => {
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
                <Badge
                    color="warning"
                    badgeContent={<Typography variant="caption">beta</Typography>}
                >
                    <Typography sx={NavbarStyles.logoText}>neurosynth compose</Typography>
                </Badge>
            </Box>
            <Box sx={{ flexGrow: 1, justifyContent: 'flex-end', display: 'flex' }}>
                <IconButton onClick={handleOpenDrawer}>
                    <MenuIcon />
                </IconButton>
            </Box>
            <Drawer anchor="right" open={isOpen} onClose={handleCloseDrawer}>
                <List>
                    <ListItem>
                        <ListItemButton>
                            <ListItemIcon>
                                <AddCircleOutlineIcon color="secondary" />
                            </ListItemIcon>
                            <ListItemText sx={{ color: 'secondary.main' }} primary="NEW PROJECT" />
                        </ListItemButton>
                    </ListItem>
                    <ListItem>
                        <ListItemButton>
                            <ListItemIcon />
                            <ListItemText primary="MY PROJECTS" />
                        </ListItemButton>
                    </ListItem>
                    <DrawerToggleMenu labelText="EXPLORE">
                        <ListItem>
                            <ListItemButton>
                                <ListItemIcon />
                                <ListItemText primary="studies" />
                            </ListItemButton>
                        </ListItem>
                        <ListItem>
                            <ListItemButton>
                                <ListItemIcon />
                                <ListItemText primary="studysets" />
                            </ListItemButton>
                        </ListItem>
                        <ListItem>
                            <ListItemButton>
                                <ListItemIcon />
                                <ListItemText primary="meta-analyses" />
                            </ListItemButton>
                        </ListItem>
                    </DrawerToggleMenu>
                    <ListItem>
                        <ListItemButton>
                            <ListItemIcon>
                                <OpenInNewIcon />
                            </ListItemIcon>
                            <ListItemText primary="HELP" />
                        </ListItemButton>
                    </ListItem>
                    <ListItem>
                        <ListItemButton>
                            <ListItemIcon />
                            <ListItemText
                                sx={{
                                    color: isAuthenticated ? 'black' : 'warning.dark',
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

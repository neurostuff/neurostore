import {
    Box,
    Typography,
    Toolbar,
    IconButton,
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Button,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useState } from 'react';
import { NavLink, useHistory } from 'react-router-dom';
import NavbarStyles from '../Navbar.styles';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DrawerToggleMenu from '../NavSubMenu/DrawerToggleSubMenu';
import { useAuth0 } from '@auth0/auth0-react';
import CreateDetailsDialog from 'components/Dialogs/CreateDetailsDialog/CreateDetailsDialog';
import { INav } from '../Navbar';

const NavDrawer: React.FC<INav> = (props) => {
    const { isAuthenticated } = useAuth0();
    const [isOpen, setIsOpen] = useState(false);
    const [createDetailsDialogIsOpen, setCreateDetailsDialogIsOpen] = useState(false);
    const history = useHistory();

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
                    <CreateDetailsDialog
                        titleText="Create new project"
                        nameLabel="Project Name"
                        descriptionLabel="Project Description"
                        isOpen={createDetailsDialogIsOpen}
                        onCreate={props.onCreateProject}
                        onCloseDialog={() => setCreateDetailsDialogIsOpen(false)}
                    />
                    {isAuthenticated && (
                        <>
                            <ListItem>
                                <ListItemButton onClick={() => setCreateDetailsDialogIsOpen(true)}>
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
                                <ListItemButton onClick={() => history.push('/projects')}>
                                    <ListItemIcon />
                                    <ListItemText primary="MY PROJECTS" />
                                </ListItemButton>
                            </ListItem>
                        </>
                    )}
                    <DrawerToggleMenu labelText="EXPLORE">
                        <List>
                            <ListItem>
                                <ListItemButton onClick={() => history.push('/base-studies')}>
                                    <ListItemIcon />
                                    <ListItemText primary="studies" />
                                </ListItemButton>
                            </ListItem>
                            <ListItem>
                                <ListItemButton onClick={() => history.push('/studysets')}>
                                    <ListItemIcon />
                                    <ListItemText primary="studysets" />
                                </ListItemButton>
                            </ListItem>
                            <ListItem>
                                <ListItemButton onClick={() => history.push('/meta-analyses')}>
                                    <ListItemIcon />
                                    <ListItemText primary="meta-analyses" />
                                </ListItemButton>
                            </ListItem>
                        </List>
                    </DrawerToggleMenu>
                    <ListItem>
                        <Button
                            sx={{ display: 'flex', padding: '8px 16px', width: '100%' }}
                            target="_blank"
                            href="https://neurostuff.github.io/neurostore/"
                        >
                            <ListItemIcon>
                                <OpenInNewIcon />
                            </ListItemIcon>
                            <ListItemText primary="HELP" sx={{ color: 'black' }} />
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

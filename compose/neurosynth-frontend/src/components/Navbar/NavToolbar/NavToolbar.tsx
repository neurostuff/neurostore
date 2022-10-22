import { useAuth0 } from '@auth0/auth0-react';
import { Box, Button, Typography, Badge, Toolbar } from '@mui/material';
import NavbarStyles from '../Navbar.styles';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { NavLink } from 'react-router-dom';
import { NavbarArgs } from '..';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CreateDetailsDialog from 'components/Dialogs/CreateDetailsDialog/CreateDetailsDialog';
import NavToolbarStyles from './NavToolbar.styles';
import NavPopupMenu from '../NavSubMenu/NavPopupMenu';
import MenuItem from '@mui/material/MenuItem';
import { useState } from 'react';

const NavbarToolbar: React.FC<NavbarArgs> = (props) => {
    const { isAuthenticated } = useAuth0();
    const [createDetailsDialogIsOpen, setCreateDetailsDialogIsOpen] = useState(false);

    return (
        <Toolbar>
            <Box sx={NavbarStyles.toolbar}>
                <Box component={NavLink} to="/" sx={NavbarStyles.logoContainer}>
                    <Box
                        component="img"
                        sx={NavbarStyles.logo}
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

                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CreateDetailsDialog
                        titleText="Create new project"
                        isOpen={createDetailsDialogIsOpen}
                        onCreate={(name: string, description: string) => {
                            // create project logic here
                        }}
                        onCloseDialog={() => setCreateDetailsDialogIsOpen(false)}
                    />
                    <Button
                        variant="contained"
                        onClick={() => setCreateDetailsDialogIsOpen(true)}
                        sx={[NavToolbarStyles.menuItem, { margin: '0 15px' }]}
                        color="secondary"
                        startIcon={<AddCircleOutlineIcon />}
                    >
                        new project
                    </Button>
                    <Button
                        sx={[
                            NavToolbarStyles.menuItemColor,
                            NavToolbarStyles.menuItemPadding,
                            NavToolbarStyles.menuItem,
                        ]}
                    >
                        my projects
                    </Button>

                    <NavPopupMenu
                        buttonProps={{
                            sx: [
                                NavToolbarStyles.menuItemColor,
                                NavToolbarStyles.menuItemPadding,
                                NavToolbarStyles.menuItem,
                            ],
                            endIcon: <KeyboardArrowDownIcon />,
                        }}
                        buttonLabel="explore"
                    >
                        <MenuItem>Studies</MenuItem>
                        <MenuItem>Studysets</MenuItem>
                        <MenuItem>Meta-Analyses</MenuItem>
                    </NavPopupMenu>

                    <Button
                        endIcon={<OpenInNewIcon />}
                        variant="outlined"
                        sx={[
                            NavToolbarStyles.menuItemColor,
                            NavToolbarStyles.menuItemPadding,
                            NavToolbarStyles.menuItem,
                        ]}
                    >
                        help
                    </Button>
                    <Button
                        variant="outlined"
                        sx={[
                            NavToolbarStyles.menuItemColor,
                            NavToolbarStyles.menuItemPadding,
                            NavToolbarStyles.menuItem,
                        ]}
                    >
                        {isAuthenticated ? 'Logout' : 'Sign in/Sign up'}
                    </Button>
                </Box>
            </Box>
        </Toolbar>
    );
};

export default NavbarToolbar;

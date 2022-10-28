import { useAuth0 } from '@auth0/auth0-react';
import {
    Box,
    Button,
    Typography,
    Badge,
    Toolbar,
    ListItem,
    ListItemButton,
    ListItemText,
} from '@mui/material';
import NavbarStyles from '../Navbar.styles';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { NavLink, useHistory } from 'react-router-dom';
import { NavbarArgs } from '..';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CreateDetailsDialog from 'components/Dialogs/CreateDetailsDialog/CreateDetailsDialog';
import NavToolbarStyles from './NavToolbar.styles';
import NavPopupMenu from '../NavSubMenu/NavPopupMenu';
import MenuItem from '@mui/material/MenuItem';
import { useState } from 'react';
import Link from '@mui/material/Link';

const NavbarToolbar: React.FC<NavbarArgs> = (props) => {
    const { isAuthenticated } = useAuth0();
    const [createDetailsDialogIsOpen, setCreateDetailsDialogIsOpen] = useState(false);
    const history = useHistory();

    return (
        <Toolbar disableGutters>
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
                    {isAuthenticated && (
                        <>
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
                                onClick={() => history.push('/projects')}
                                sx={[
                                    NavToolbarStyles.menuItemColor,
                                    NavToolbarStyles.menuItemPadding,
                                    NavToolbarStyles.menuItem,
                                ]}
                            >
                                my projects
                            </Button>
                        </>
                    )}

                    <NavPopupMenu
                        buttonProps={{
                            sx: [
                                NavToolbarStyles.menuItemColor,
                                NavToolbarStyles.menuItemPadding,
                                NavToolbarStyles.menuItem,
                            ],
                            endIcon: <KeyboardArrowDownIcon />,
                        }}
                        options={[
                            {
                                label: 'STUDIES',
                                onClick: () => history.push('/studies'),
                            },
                            {
                                label: 'STUDYSETS',
                                onClick: () => history.push('/studysets'),
                            },
                            {
                                label: 'META-ANALYSES',
                                onClick: () => history.push('/meta-analyses'),
                            },
                        ]}
                        buttonLabel="explore"
                    />
                    <Button
                        sx={[
                            NavToolbarStyles.menuItemColor,
                            NavToolbarStyles.menuItemPadding,
                            NavToolbarStyles.menuItem,
                        ]}
                        variant="outlined"
                        target="_blank"
                        href="https://neurostuff.github.io/neurostore/"
                    >
                        HELP
                        <OpenInNewIcon sx={{ marginLeft: '8px', fontSize: '1.2rem' }} />
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={() => {
                            isAuthenticated ? props.logout() : props.login();
                        }}
                        sx={[
                            NavToolbarStyles.menuItemColor,
                            NavToolbarStyles.menuItemPadding,
                            NavToolbarStyles.menuItem,
                        ]}
                    >
                        {isAuthenticated ? 'LOGOUT' : 'SIGN IN/SIGN UP'}
                    </Button>
                </Box>
            </Box>
        </Toolbar>
    );
};

export default NavbarToolbar;

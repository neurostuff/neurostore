import { useAuth0 } from '@auth0/auth0-react';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, Button, Toolbar, Typography } from '@mui/material';
import CreateDetailsDialog from 'components/Dialogs/CreateDetailsDialog/CreateDetailsDialog';
import NavToolbarPopupSubMenu from 'components/Navbar/NavSubMenu/NavToolbarPopupSubMenu';
import { useState } from 'react';
import { NavLink, useHistory } from 'react-router-dom';
import { INav } from '../Navbar';
import NavbarStyles from '../Navbar.styles';
import NeurosynthAvatar from 'components/Navbar/NeurosynthAvatar/NeurosynthAvatar';
import NavToolbarStyles from './NavToolbar.styles';

const NavToolbar: React.FC<INav> = (props) => {
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
                    <Typography sx={NavbarStyles.logoText}>neurosynth compose</Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center' }}>
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

                    <NavToolbarPopupSubMenu
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
                                onClick: () => history.push('/base-studies'),
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
                        href="https://neurostuff.github.io/compose-docs/"
                    >
                        DOCS
                        <OpenInNewIcon sx={{ marginLeft: '8px', fontSize: '1.2rem' }} />
                    </Button>
                    <NeurosynthAvatar onLogout={props.onLogout} onLogin={props.onLogin} />
                </Box>
            </Box>
        </Toolbar>
    );
};

export default NavToolbar;

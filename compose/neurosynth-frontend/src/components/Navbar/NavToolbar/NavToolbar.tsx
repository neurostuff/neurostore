import { useAuth0 } from '@auth0/auth0-react';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, Button, Toolbar, Typography } from '@mui/material';
import NavToolbarPopupSubMenu from 'components/Navbar/NavSubMenu/NavToolbarPopupSubMenu';
import NeurosynthAvatar from 'components/Navbar/NeurosynthAvatar/NeurosynthAvatar';
import { NavLink, useNavigate } from 'react-router-dom';
import { INav } from '../Navbar';
import NavbarStyles from '../Navbar.styles';
import NavToolbarStyles from './NavToolbar.styles';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';

const NavToolbar: React.FC<INav> = (props) => {
    const { isAuthenticated } = useAuth0();
    const navigate = useNavigate();

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
                    {isAuthenticated && (
                        <>
                            <LoadingButton
                                variant="contained"
                                loaderColor="primary"
                                isLoading={props.createProjectIsLoading || false}
                                onClick={() => props.onCreateProject('Untitled', '')}
                                sx={[
                                    NavToolbarStyles.menuItem,
                                    { margin: '0 15px', width: '170px' },
                                ]}
                                color="secondary"
                                startIcon={<AddCircleOutlineIcon />}
                                text="NEW PROJECT"
                            />
                            <Button
                                onClick={() => navigate('/projects')}
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
                                onClick: () => navigate('/base-studies'),
                            },
                            {
                                label: 'META-ANALYSES',
                                onClick: () => navigate('/meta-analyses'),
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
                        rel="noreferrer"
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

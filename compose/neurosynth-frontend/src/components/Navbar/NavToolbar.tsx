import { useAuth0 } from '@auth0/auth0-react';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, Button, Toolbar, Typography } from '@mui/material';
import CreateProjectButton from 'components/Buttons/CreateProjectButton';
import NeurosynthAvatar from 'components/Navbar/NeurosynthAvatar';
import { NavLink, useNavigate } from 'react-router-dom';
import NavToolbarPopupSubMenu from './NavToolbarPopupSubMenu';
import { INav } from './Navbar';
import NavbarStyles from './Navbar.styles';
import NavToolbarStyles from './NavToolbar.styles';

const NavToolbar: React.FC<INav> = (props) => {
    const { isAuthenticated } = useAuth0();
    const navigate = useNavigate();

    return (
        <Toolbar disableGutters>
            <Box sx={NavbarStyles.toolbar}>
                <Box component={NavLink} to="/" sx={NavbarStyles.logoContainer}>
                    <Box component="img" sx={NavbarStyles.logo} alt="neurosynth compose logo" src="/static/synth.png" />
                    <Typography sx={NavbarStyles.logoText}>neurosynth compose</Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {isAuthenticated && (
                        <>
                            <CreateProjectButton />
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
                                label: 'Studies',
                                onClick: () => navigate('/base-studies'),
                            },
                            {
                                label: 'Meta-Analyses',
                                onClick: () => navigate('/meta-analyses'),
                            },
                        ]}
                        buttonLabel="explore"
                    />

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
                                label: (
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        Documentation <OpenInNewIcon fontSize="small" sx={{ ml: 1 }} />
                                    </Box>
                                ),
                                onClick: () => window.open('https://neurostuff.github.io/compose-docs/', '_blank'),
                            },
                            {
                                label: 'Get Help',
                                onClick: () => navigate('/help'),
                            },
                        ]}
                        buttonLabel="help"
                    />
                    <NeurosynthAvatar onLogout={props.onLogout} onLogin={props.onLogin} />
                </Box>
            </Box>
        </Toolbar>
    );
};

export default NavToolbar;

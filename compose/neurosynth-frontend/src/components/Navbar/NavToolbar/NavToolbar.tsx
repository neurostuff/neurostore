import { useAuth0 } from '@auth0/auth0-react';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, Button, Toolbar, Typography } from '@mui/material';
import CreateProjectButton from 'components/Buttons/CreateProjectButton/CreateProjectButton';
import NeurosynthAvatar from 'components/Navbar/NeurosynthAvatar/NeurosynthAvatar';
import NeurosynthPopupMenu from 'components/NeurosynthPopupMenu/NeurosynthPopupMenu';
import { NavLink, useNavigate } from 'react-router-dom';
import { INav } from '../Navbar';
import NavbarStyles from '../Navbar.styles';
import NavToolbarStyles from './NavToolbar.styles';
import NavToolbarPopupSubMenu from '../NavSubMenu/NavToolbarPopupSubMenu';

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

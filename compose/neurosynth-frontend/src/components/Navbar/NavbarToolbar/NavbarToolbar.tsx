import { useAuth0 } from '@auth0/auth0-react';
import { Box, Button, Typography, Badge, Toolbar } from '@mui/material';
import { NavLink } from 'react-router-dom';
import { NavbarArgs } from '..';
import NavbarStyles from '../Navbar.styles';
import NavbarToolbarStyles from './NavbarToolbar.styles';
import NavbarPopupMenu from '../NavbarPopupMenu/NavbarPopupMenu';

const NavbarToolbar: React.FC<NavbarArgs> = (props) => {
    const { isAuthenticated } = useAuth0();

    return (
        <Toolbar sx={[NavbarStyles.toolbar, NavbarStyles.mdUp]}>
            <Box style={{ display: 'flex', alignItems: 'center' }}>
                <img
                    alt="neurosynth compose logo"
                    style={{
                        width: '65px',
                        height: '65px',
                        marginRight: '1rem',
                        cursor: 'pointer',
                    }}
                    src="/static/synth.png"
                />
                <Box to="/" exact sx={NavbarStyles.neurosynthLink} component={NavLink}>
                    <Typography variant="h4">
                        <Badge color="warning" badgeContent={<span>beta</span>}>
                            neurosynth compose
                        </Badge>
                    </Typography>
                </Box>
            </Box>
            <Box sx={NavbarToolbarStyles.navLinksContainer}>
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
                        ]}
                    >
                        {isAuthenticated ? 'Logout' : 'Sign in/Sign up'}
                    </Typography>
                </Button>
            </Box>
        </Toolbar>
    );
};

export default NavbarToolbar;

import { useAuth0 } from '@auth0/auth0-react';
import { Box, Button, Typography, Badge } from '@mui/material';
import { NavLink } from 'react-router-dom';
import { NavbarArgs } from '..';
import NavbarStyles from '../Navbar.styles';
import NavbarToolbarStyles from './NavbarToolbar.styles';
import NavbarPopupMenu from '../NavbarPopupMenu/NavbarPopupMenu';

const NavbarToolbar: React.FC<NavbarArgs> = (props) => {
    const { isAuthenticated } = useAuth0();

    return (
        <>
            <Button>
                <Box to="/" exact sx={NavbarStyles.neurosynthLink} component={NavLink}>
                    <Typography variant="h5">
                        <Badge color="secondary" badgeContent={<span>alpha</span>}>
                            neurosynth
                        </Badge>
                    </Typography>
                </Box>
            </Button>
            <Box sx={NavbarToolbarStyles.navLinksContainer}>
                {props.navOptions.map((navOption) => (
                    <NavbarPopupMenu
                        key={navOption.label}
                        navOption={navOption}
                        menuPosition={{ vertical: 'bottom', horizontal: 'left' }}
                        sx={{
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
                    <Box component="span" sx={NavbarToolbarStyles.link}>
                        {isAuthenticated ? 'Logout' : 'Login'}
                    </Box>
                </Button>
            </Box>
        </>
    );
};

export default NavbarToolbar;

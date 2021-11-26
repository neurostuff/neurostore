import { useAuth0 } from '@auth0/auth0-react';
import { Box, Button, Typography, Badge } from '@mui/material';
import { NavLink } from 'react-router-dom';
import { NavbarArgs } from '..';
import NavbarStyles from '../Navbar.styles';
import NavbarToolbarStyles from './NavbarToolbar.styles';

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
                {props.navOptions.map((navItem, index) => (
                    <Button key={index} sx={NavbarToolbarStyles.button}>
                        <Box
                            to={navItem.path}
                            exact
                            component={NavLink}
                            sx={NavbarToolbarStyles.link}
                            // manually add bg color as navlink doesn't have access to mui system
                            activeStyle={{ color: '#ef8a24' }}
                        >
                            {navItem.label}
                        </Box>
                    </Button>
                ))}
                {!isAuthenticated && (
                    <Button sx={NavbarToolbarStyles.button} onClick={props.login}>
                        <Box component="span" sx={NavbarToolbarStyles.link}>
                            Login
                        </Box>
                    </Button>
                )}
                {isAuthenticated && (
                    <Button sx={NavbarToolbarStyles.button} onClick={props.logout}>
                        <Box component="span" sx={NavbarToolbarStyles.link}>
                            Logout
                        </Box>
                    </Button>
                )}
            </Box>
        </>
    );
};

export default NavbarToolbar;

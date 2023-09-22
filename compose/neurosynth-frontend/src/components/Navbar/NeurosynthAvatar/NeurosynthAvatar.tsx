import { useAuth0 } from '@auth0/auth0-react';
import {
    Avatar,
    Button,
    IconButton,
    ListItem,
    ListItemButton,
    ListItemText,
    Menu,
} from '@mui/material';
import { useState } from 'react';
import { useHistory } from 'react-router-dom';
import NavToolbarStyles from 'components/Navbar/NavToolbar/NavToolbar.styles';

const NeurosynthAvatar: React.FC<{ onLogin: () => void; onLogout: () => void }> = (props) => {
    const history = useHistory();
    const { user, isAuthenticated } = useAuth0();
    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

    const handleOpenAvatarMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleCloseAvatarMenu = () => {
        setAnchorEl(null);
    };

    const handleDirectToUserProfile = () => {
        history.push('/user-profile');
        handleCloseAvatarMenu();
    };

    return (
        <>
            {isAuthenticated ? (
                <>
                    <IconButton onClick={handleOpenAvatarMenu}>
                        <Avatar alt={user?.name || ''} src={user?.picture} />
                    </IconButton>
                    <Menu
                        onClose={handleCloseAvatarMenu}
                        open={Boolean(anchorEl)}
                        anchorEl={anchorEl}
                    >
                        <ListItem>
                            <ListItemButton onClick={handleDirectToUserProfile}>
                                <ListItemText>PROFILE</ListItemText>
                            </ListItemButton>
                        </ListItem>
                        <ListItem>
                            <ListItemButton onClick={props.onLogout}>
                                <ListItemText>LOGOUT</ListItemText>
                            </ListItemButton>
                        </ListItem>
                    </Menu>
                </>
            ) : (
                <Button
                    sx={[
                        NavToolbarStyles.menuItemColor,
                        NavToolbarStyles.menuItemPadding,
                        NavToolbarStyles.menuItem,
                    ]}
                    onClick={props.onLogin}
                >
                    SIGN IN/SIGN UP
                </Button>
            )}
        </>
    );
};

export default NeurosynthAvatar;

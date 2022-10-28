import Button, { ButtonProps } from '@mui/material/Button';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import { useState } from 'react';
import { useHistory } from 'react-router-dom';

interface INavPopupMenu {
    buttonProps: ButtonProps;
    buttonLabel: string;
    options: {
        label: string;
        secondary?: string;
        onClick: () => void;
    }[];
}

const NavPopupMenu: React.FC<INavPopupMenu> = (props) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLButtonElement>(null);
    const open = Boolean(anchorEl);
    const history = useHistory();

    const handleButtonPress = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleCloseNavMenu = () => {
        setAnchorEl(null);
    };

    return (
        <>
            <Button {...props.buttonProps} onClick={handleButtonPress}>
                {props.buttonLabel}
            </Button>
            <Menu open={open} onClose={handleCloseNavMenu} anchorEl={anchorEl}>
                {props.options.map((option) => (
                    <ListItem key={option.label}>
                        <ListItemButton onClick={() => option.onClick()}>
                            <ListItemText
                                primary={option.label}
                                secondary={option?.secondary || ''}
                            />
                        </ListItemButton>
                    </ListItem>
                ))}
            </Menu>
        </>
    );
};

export default NavPopupMenu;

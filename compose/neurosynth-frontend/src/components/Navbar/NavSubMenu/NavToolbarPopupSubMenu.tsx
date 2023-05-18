import { ListItem, ListItemButton, ListItemText, Menu, Button, ButtonProps } from '@mui/material';
import { useState } from 'react';

export interface INavToolbarPopupSubMenu {
    buttonProps: ButtonProps;
    buttonLabel: string;
    options: {
        label: string;
        secondary?: string;
        onClick: () => void;
    }[];
}

const NavToolbarPopupSubMenu: React.FC<INavToolbarPopupSubMenu> = (props) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLButtonElement>(null);
    const open = Boolean(anchorEl);

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
                        <ListItemButton
                            onClick={() => {
                                option.onClick();
                                handleCloseNavMenu();
                            }}
                        >
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

export default NavToolbarPopupSubMenu;

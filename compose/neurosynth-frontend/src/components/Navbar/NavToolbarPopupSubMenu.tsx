import { ListItem, ListItemButton, ListItemText, Menu, Button, ButtonProps } from '@mui/material';
import { useState } from 'react';

export interface INavToolbarPopupSubMenu {
    buttonProps: ButtonProps;
    buttonLabel: string;
    compactOptions?: boolean;
    options: {
        label: string | React.ReactNode;
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
            <Menu
                open={open}
                onClose={handleCloseNavMenu}
                anchorEl={anchorEl}
                MenuListProps={props.compactOptions ? { dense: true, sx: { py: 0.25 } } : undefined}
            >
                {props.options.map((option) => (
                    <ListItem key={option.label} disablePadding={props.compactOptions}>
                        <ListItemButton
                            dense={props.compactOptions}
                            sx={props.compactOptions ? { py: 0.35, px: 1.25 } : undefined}
                            onClick={() => {
                                option.onClick();
                                handleCloseNavMenu();
                            }}
                        >
                            <ListItemText
                                primary={option.label}
                                secondary={option?.secondary || ''}
                                primaryTypographyProps={props.compactOptions ? { variant: 'body2' } : undefined}
                                secondaryTypographyProps={props.compactOptions ? { variant: 'caption' } : undefined}
                            />
                        </ListItemButton>
                    </ListItem>
                ))}
            </Menu>
        </>
    );
};

export default NavToolbarPopupSubMenu;

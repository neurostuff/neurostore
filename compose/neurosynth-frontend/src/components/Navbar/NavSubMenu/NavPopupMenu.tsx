import Button, { ButtonProps } from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import { useRef, useState } from 'react';

interface INavPopupMenu {
    buttonProps: ButtonProps;
    buttonLabel: string;
}

const NavPopupMenu: React.FC<INavPopupMenu> = (props) => {
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
                anchorOrigin={{ vertical: 52, horizontal: 'left' }}
                onClose={handleCloseNavMenu}
                anchorEl={anchorEl}
            >
                {props.children}
            </Menu>
        </>
    );
};

export default NavPopupMenu;

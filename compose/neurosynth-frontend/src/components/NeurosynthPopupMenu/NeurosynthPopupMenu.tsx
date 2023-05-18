import { Menu, Button, ButtonProps, MenuItem } from '@mui/material';
import { useState } from 'react';

export interface INeurosynthPopupMenu {
    buttonProps: ButtonProps;
    buttonLabel: string;
    options: {
        label: string;
        value: string | number;
        onClick: (val: string | number) => void;
    }[];
}

const NeurosynthPopupMenu: React.FC<INeurosynthPopupMenu> = (props) => {
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
                    <MenuItem
                        key={option.label}
                        value={option.value}
                        onClick={() => {
                            option.onClick(option.value);
                            handleCloseNavMenu();
                        }}
                    >
                        {option.label}
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
};

export default NeurosynthPopupMenu;

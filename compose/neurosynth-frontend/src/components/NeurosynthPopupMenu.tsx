import { Menu, Button, ButtonProps, MenuItem } from '@mui/material';
import { useState } from 'react';

export interface INeurosynthPopupMenu {
    buttonLabel: string | React.ReactNode;
    anchorEl?: HTMLElement | null;
    options: {
        label: string;
        value: string | number;
        onClick: (val: string | number) => void;
    }[];
}

const NeurosynthPopupMenu: React.FC<INeurosynthPopupMenu & ButtonProps> = (props) => {
    const { buttonLabel, options, anchorEl: anchorElFromProps = null, ...buttonProps } = props;
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(anchorElFromProps);
    const open = Boolean(anchorEl);

    const handleButtonPress = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(anchorElFromProps || event.currentTarget);
    };

    const handleCloseNavMenu = () => {
        setAnchorEl(null);
    };

    return (
        <>
            <Button {...buttonProps} onClick={handleButtonPress}>
                {buttonLabel}
            </Button>
            <Menu open={open} onClose={handleCloseNavMenu} anchorEl={anchorEl}>
                {options.map((option) => (
                    <MenuItem
                        key={option.label}
                        value={option.value}
                        sx={{
                            fontSize: {
                                xs: '0.7rem',
                                lg: '1rem',
                            },
                        }}
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

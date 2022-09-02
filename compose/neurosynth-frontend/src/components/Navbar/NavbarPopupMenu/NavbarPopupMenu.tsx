import { useAuth0 } from '@auth0/auth0-react';
import { MenuItem, Button, MenuList } from '@mui/material';
import { SystemStyleObject } from '@mui/system';
import { useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { NavOptionsModel } from '..';
import NeurosynthPopper from 'components/NeurosynthPopper/NeurosynthPopper';
import NavbarPopupMenuStyles from './NavbarPopupMenu.styles';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

export interface INavbarPopupMenu {
    navOption: NavOptionsModel;
    styling?: SystemStyleObject;
    menuPosition: {
        vertical: 'top' | 'bottom';
        horizontal: 'left' | 'right';
    };
}

const NavbarPopupMenu: React.FC<INavbarPopupMenu> = (props) => {
    const [open, setOpen] = useState(false);
    const { isAuthenticated } = useAuth0();
    const anchorRef = useRef<HTMLButtonElement>(null);

    const menuItems: JSX.Element[] = [];
    props.navOption.children?.forEach((navOption) => {
        const shouldSee = !navOption.authenticationRequired || isAuthenticated;
        if (shouldSee)
            menuItems.push(
                <MenuItem
                    key={navOption.label}
                    to={navOption.path}
                    component={NavLink}
                    exact
                    onClick={() => setOpen(false)}
                    disabled={navOption.disabled}
                    activeStyle={{ color: '#ef8a24' }}
                >
                    {navOption.label}
                </MenuItem>
            );
    });

    const shouldSee = !props.navOption.authenticationRequired || isAuthenticated;

    if (shouldSee) {
        if (props.navOption.children) {
            return (
                <>
                    <Button
                        ref={anchorRef}
                        onClick={() => setOpen(true)}
                        sx={[
                            props.styling || {},
                            { whiteSpace: 'nowrap' },
                            NavbarPopupMenuStyles.button,
                        ]}
                        className={props.navOption.className || ''}
                        disabled={props.navOption.disabled}
                    >
                        {props.navOption.label}
                        <KeyboardArrowDownIcon sx={{ marginLeft: '0.25rem' }} />
                    </Button>
                    <NeurosynthPopper
                        open={open}
                        anchorElement={anchorRef.current}
                        onClickAway={(event: any) => setOpen(false)}
                    >
                        <MenuList>{menuItems}</MenuList>
                    </NeurosynthPopper>
                </>
            );
        } else {
            return (
                <Button
                    disabled={props.navOption.disabled}
                    to={props.navOption.path}
                    exact
                    component={NavLink}
                    sx={[
                        props.styling || {},
                        NavbarPopupMenuStyles.link,
                        NavbarPopupMenuStyles.button,
                    ]}
                    // manually add bg color as navlink doesn't have access to mui system
                    activeStyle={{ color: '#ef8a24' }}
                >
                    {props.navOption.label}
                </Button>
            );
        }
    }

    return <></>;
};

export default NavbarPopupMenu;

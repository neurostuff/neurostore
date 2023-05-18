import { ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { useState } from 'react';
import { KeyboardArrowDownOutlined, KeyboardArrowUpOutlined } from '@mui/icons-material';

interface IDrawerToggleSubMenu {
    labelText: string;
}

const DrawerToggleSubMenu: React.FC<IDrawerToggleSubMenu> = (props) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <>
            <ListItem>
                <ListItemButton onClick={() => setExpanded((prev) => !prev)}>
                    <ListItemIcon>
                        {expanded ? <KeyboardArrowUpOutlined /> : <KeyboardArrowDownOutlined />}
                    </ListItemIcon>
                    <ListItemText primary={props.labelText} />
                </ListItemButton>
            </ListItem>

            {expanded && <>{props.children}</>}
        </>
    );
};

export default DrawerToggleSubMenu;

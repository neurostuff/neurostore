import { ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { type ReactNode,  useState } from 'react';
import { KeyboardArrowDownOutlined, KeyboardArrowUpOutlined } from '@mui/icons-material';

interface IDrawerToggleSubMenu {
    labelText: string;
    children?: React.ReactNode;
}

const DrawerToggleSubMenu = (props: IDrawerToggleSubMenu) => {
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

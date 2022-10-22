import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { useState } from 'react';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { KeyboardArrowDownOutlined, KeyboardArrowUpOutlined } from '@mui/icons-material';
import Box from '@mui/material/Box';

interface IDrawerToggleMenu {
    labelText: string;
}

const DrawerToggleMenu: React.FC<IDrawerToggleMenu> = (props) => {
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

export default DrawerToggleMenu;

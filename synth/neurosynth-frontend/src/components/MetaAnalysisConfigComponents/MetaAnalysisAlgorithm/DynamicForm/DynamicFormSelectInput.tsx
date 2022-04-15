import { Box, MenuItem, Select, Typography } from '@mui/material';
import { useState } from 'react';
import { IDynamicFormInput } from './DynamicForm';

const DynamicFormSelectInput: React.FC<IDynamicFormInput> = (props) => {
    const [selectedMenuItem, setSelectedMenuItem] = useState<string>(props.value.default as string);

    const getMenuItems = (menuItems: string): string[] => {
        if (typeof menuItems !== 'string') return [];

        const parsedMenuItems = menuItems.replace('{', '[').replace('}', ']');
        return JSON.parse(parsedMenuItems);
    };

    const menuItems = getMenuItems(props.value.type);

    return (
        <Box sx={{ marginBottom: '2.5rem' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                {props.parameterName}
            </Typography>
            <Typography sx={{ marginBottom: '1rem' }} variant="subtitle2">
                {props.value.description}
            </Typography>

            <Select
                sx={{ width: '50%' }}
                value={selectedMenuItem}
                onChange={(event) => setSelectedMenuItem(event.target.value as string)}
            >
                {menuItems.map((menuItem) => (
                    <MenuItem key={menuItem} value={menuItem}>
                        {menuItem}
                    </MenuItem>
                ))}
            </Select>
        </Box>
    );
};

export default DynamicFormSelectInput;

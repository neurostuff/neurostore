import { Box, MenuItem, Select } from '@mui/material';
import { useState } from 'react';
import MetaAnalysisAlgorithmStyles from '../MetaAnalysisAlgorithm.styles';
import { IDynamicFormInput } from './DynamicForm';
import DynamicFormBaseTitle from './DynamicFormBaseTitle';

const DynamicFormSelectInput: React.FC<IDynamicFormInput> = (props) => {
    const [selectedMenuItem, setSelectedMenuItem] = useState<string>(props.value.default as string);

    const getMenuItems = (menuItems: string): string[] => {
        if (typeof menuItems !== 'string') return [];

        const parsedMenuItems = menuItems.replace('{', '[').replace('}', ']');
        return JSON.parse(parsedMenuItems);
    };

    const menuItems = getMenuItems(props.value.type);

    return (
        <Box sx={MetaAnalysisAlgorithmStyles.input}>
            <DynamicFormBaseTitle
                name={props.parameterName}
                description={props.value.description}
            />

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

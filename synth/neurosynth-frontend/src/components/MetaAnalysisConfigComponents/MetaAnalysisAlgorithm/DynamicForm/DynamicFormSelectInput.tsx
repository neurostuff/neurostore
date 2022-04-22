import { Box, MenuItem, Select } from '@mui/material';
import { useState } from 'react';
import MetaAnalysisAlgorithmStyles from '../MetaAnalysisAlgorithm.styles';
import { IDynamicFormInput } from '../..';
import DynamicFormBaseTitle from './DynamicFormBaseTitle';

const DynamicFormSelectInput: React.FC<IDynamicFormInput> = (props) => {
    const getMenuItems = (menuItems: string | null): string[] => {
        if (typeof menuItems !== 'string') return [];

        const parsedMenuItems = menuItems.replace('{', '[').replace('}', ']');
        return JSON.parse(parsedMenuItems);
    };

    const menuItems = getMenuItems(props.parameter?.type || null);

    return (
        <Box sx={MetaAnalysisAlgorithmStyles.input}>
            <DynamicFormBaseTitle
                name={props.parameterName}
                description={props.parameter.description}
            />

            <Select
                sx={{ width: '50%' }}
                value={props.value || null}
                onChange={(event) =>
                    props.onUpdate({
                        [props.parameterName]: event.target.value,
                    })
                }
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

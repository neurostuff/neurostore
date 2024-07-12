import { Box, MenuItem, Select } from '@mui/material';
import { IDynamicFormInput } from 'pages/MetaAnalysis/components/DynamicForm.types';
import MetaAnalysisDynamicFormTitle from './MetaAnalysisDynamicFormTitle';
import DynamicFormStyles from 'pages/MetaAnalysis/components//DynamicFormStyles';

const DynamicFormSelectInput: React.FC<IDynamicFormInput> = (props) => {
    const getMenuItems = (menuItems: string | null): string[] => {
        if (typeof menuItems !== 'string') return [];

        const parsedMenuItems = menuItems.replace('{', '[').replace('}', ']');
        return JSON.parse(parsedMenuItems);
    };

    const menuItems = getMenuItems(props.parameter?.type || null);

    return (
        <Box sx={DynamicFormStyles.input}>
            <MetaAnalysisDynamicFormTitle
                name={props.parameterName}
                description={props.parameter.description}
            />

            <Select
                sx={{ width: '50%' }}
                value={props.value || ''}
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

import { FormControl, MenuItem, Select, SelectChangeEvent, Box } from '@mui/material';
import React, { ReactNode } from 'react';
import { EPropertyType, IToggleTypeModel } from 'components/EditMetadata/EditMetadata.types';
import ToggleTypeStyles from './ToggleType.styles';

const ToggleType: React.FC<IToggleTypeModel> = React.memo((props) => {
    const {
        onToggle,
        type,
        allowNone = true,
        allowBoolean = true,
        allowNumber = true,
        allowString = true,
        disabled = false,
    } = props;

    const handleSetType = (event: SelectChangeEvent<EPropertyType>, child: ReactNode) => {
        const selected = event.target.value as EPropertyType;
        onToggle(selected);
    };

    const myClass: 'type_number' | 'type_boolean' | 'type_string' | 'type_none' = `type_${type}`;

    return (
        <Box sx={ToggleTypeStyles.toggleItemContainer}>
            <FormControl variant="outlined">
                <Select
                    disabled={disabled}
                    sx={[ToggleTypeStyles[myClass], ToggleTypeStyles.toggle_item]}
                    value={type}
                    onChange={handleSetType}
                >
                    {allowString && (
                        <MenuItem sx={ToggleTypeStyles.type_string} value="string">
                            STRING
                        </MenuItem>
                    )}
                    {allowNumber && (
                        <MenuItem sx={ToggleTypeStyles.type_number} value="number">
                            NUMBER
                        </MenuItem>
                    )}
                    {allowBoolean && (
                        <MenuItem sx={ToggleTypeStyles.type_boolean} value="boolean">
                            BOOLEAN
                        </MenuItem>
                    )}
                    {allowNone && (
                        <MenuItem sx={ToggleTypeStyles.type_none} value="none">
                            NONE
                        </MenuItem>
                    )}
                </Select>
            </FormControl>
        </Box>
    );
});

export default ToggleType;

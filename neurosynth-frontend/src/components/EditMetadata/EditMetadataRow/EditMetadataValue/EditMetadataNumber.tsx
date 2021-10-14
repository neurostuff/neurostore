import { TextField } from '@mui/material';
import React, { useState } from 'react';
import { IEditMetadataField } from '../..';
import EditMetadataFieldsStyles from './EditMetadataFieldsStyles';

const EditMetadataNumber: React.FC<IEditMetadataField> = (props) => {
    const [value, setValue] = useState<number>(parseInt(props.value as string));
    const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const num = parseInt(event.target.value);
        if (!isNaN(num)) {
            props.onEdit(num);
            setValue(num);
        }
    };
    return (
        <TextField
            sx={EditMetadataFieldsStyles.numberfield}
            onChange={handleChange}
            value={value}
            type="number"
            variant="outlined"
        />
    );
};

export default EditMetadataNumber;

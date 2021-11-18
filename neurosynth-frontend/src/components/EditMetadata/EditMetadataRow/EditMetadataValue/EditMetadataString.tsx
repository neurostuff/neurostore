import { TextField } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { IEditMetadataField } from '../..';
import EditMetadataFieldsStyles from './EditMetadataFields.styles';

const EditMetadataString: React.FC<IEditMetadataField> = (props) => {
    const [value, setValue] = useState(props.value?.toString() || '');

    useEffect(() => {
        setValue(props.value?.toString() || '');
    }, [props.value]);

    const handleValueChange = (
        event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
    ) => {
        props.onEdit(event.target.value);
        setValue(event.target.value);
    };

    return (
        <TextField
            multiline
            placeholder="New metadata value"
            onChange={handleValueChange}
            value={value}
            variant="outlined"
            sx={EditMetadataFieldsStyles.textfield}
        />
    );
};

export default EditMetadataString;

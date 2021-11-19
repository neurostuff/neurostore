import { TextField } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { IEditMetadataField } from '../..';
import EditMetadataFieldsStyles from './EditMetadataFields.styles';

const EditMetadataNumber: React.FC<IEditMetadataField> = (props) => {
    useEffect(() => {
        setValue(parseInt(props.value as string));
    }, [props.value]);

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

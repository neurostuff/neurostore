import { FormControlLabel, FormGroup, Switch, Typography } from '@mui/material';
import { useState } from 'react';
import { IEditMetadataField } from '../..';
import EditMetadataFieldsStyles from './EditMetadataFields.styles';

const EditMetadataBoolean: React.FC<IEditMetadataField> = (props) => {
    const [state, setState] = useState(props.value as boolean);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
        props.onEdit(checked);
        setState(checked);
    };

    return (
        <FormGroup>
            <FormControlLabel
                sx={
                    state
                        ? EditMetadataFieldsStyles.checkedTrue
                        : EditMetadataFieldsStyles.checkedFalse
                }
                control={
                    <Switch onChange={handleChange} color="primary" size="medium" checked={state} />
                }
                label={<Typography variant="caption">{state.toString()}</Typography>}
            />
        </FormGroup>
    );
};

export default EditMetadataBoolean;

import { FormControlLabel, FormGroup, Switch } from '@material-ui/core';
import { useState } from 'react';
import { IEditMetadataField } from '../EditMetadataRow';
import EditMetadataFieldsStyles from './EditMetadataFieldsStyles';

const EditMetadataBoolean: React.FC<IEditMetadataField> = (props) => {
    const classes = EditMetadataFieldsStyles();
    const [state, setState] = useState(props.value as boolean);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
        props.onEdit(checked);
        setState(checked);
    };

    return (
        <FormGroup>
            <FormControlLabel
                className={state ? classes.checkedTrue : classes.checkedFalse}
                control={
                    <Switch onChange={handleChange} color="primary" size="medium" checked={state} />
                }
                label={state.toString()}
            />
        </FormGroup>
    );
};

export default EditMetadataBoolean;

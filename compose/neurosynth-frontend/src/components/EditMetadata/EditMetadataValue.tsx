import { TextField, FormGroup, FormControlLabel, Switch, Typography, Box } from '@mui/material';
import { EPropertyType, IEditMetadataValue } from 'components/EditMetadata/EditMetadata.types';
import EditMetadataValueStyles from './EditMetadataValueStyles.styles';

const EditMetadataValue: React.FC<IEditMetadataValue> = (props) => {
    const { onEditMetadataValue, value, type, disabled = false } = props;

    const map = {
        [EPropertyType.NUMBER]: (
            <TextField
                disabled={disabled}
                size="small"
                sx={EditMetadataValueStyles.field}
                onBlur={(event) => {
                    const num = event.target.value;
                    if (num === '' || num === null || num === undefined) {
                        onEditMetadataValue(0);
                    }
                }}
                onChange={(event) => {
                    const value = event.target.value;
                    // we want to allow empty textfield for numbers for a better user experience
                    if (value === '') {
                        onEditMetadataValue('');
                    } else {
                        const num = parseInt(event.target.value);

                        if (!isNaN(num)) onEditMetadataValue(num);
                    }
                }}
                value={value}
                type="number"
                variant="outlined"
            />
        ),
        [EPropertyType.BOOLEAN]: (
            <FormGroup>
                <FormControlLabel
                    disabled={disabled}
                    sx={value ? EditMetadataValueStyles.checkedTrue : EditMetadataValueStyles.checkedFalse}
                    control={
                        <Switch
                            onChange={(event, checked) => {
                                onEditMetadataValue(checked);
                            }}
                            color="primary"
                            size="medium"
                            checked={!!value}
                        />
                    }
                    label={<Typography variant="caption">{(value || false).toString()}</Typography>}
                />
            </FormGroup>
        ),
        [EPropertyType.STRING]: (
            <TextField
                disabled={disabled}
                size="small"
                placeholder={props.placeholderText || 'New metadata value'}
                onChange={(event) => {
                    onEditMetadataValue(event.target.value);
                }}
                value={value}
                variant="outlined"
                sx={EditMetadataValueStyles.field}
            />
        ),
        [EPropertyType.NONE]: (
            <Box component="span" sx={{ color: 'warning.dark' }}>
                null
            </Box>
        ),
    };

    return <>{map[type]}</>;
};

export default EditMetadataValue;

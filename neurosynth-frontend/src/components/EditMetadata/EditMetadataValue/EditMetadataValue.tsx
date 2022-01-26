import { TextField, FormGroup, FormControlLabel, Switch, Typography, Box } from '@mui/material';
import { EPropertyType, IEditMetadataValue } from '..';
import EditMetadataValueStyles from './EditMetadata.styles';

const EditMetadataValue: React.FC<IEditMetadataValue> = (props) => {
    const { onEditMetadataValue: handleEditMetadataValue, value, type } = props;

    const map = {
        [EPropertyType.NUMBER]: (
            <TextField
                sx={EditMetadataValueStyles.numberfield}
                onBlur={(event) => {
                    const num = event.target.value;
                    if (num === '' || num === null || null === undefined) {
                        handleEditMetadataValue(0);
                    }
                }}
                onChange={(event) => {
                    const num = parseInt(event.target.value);
                    // we want to allow empty textfield for numbers for a better user experience
                    if (!isNaN(num) || event.target.value === '') {
                        handleEditMetadataValue(num);
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
                    sx={
                        value
                            ? EditMetadataValueStyles.checkedTrue
                            : EditMetadataValueStyles.checkedFalse
                    }
                    control={
                        <Switch
                            onChange={(event, checked) => {
                                handleEditMetadataValue(checked);
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
                multiline
                placeholder={props.placeholderText || 'New metadata value'}
                onChange={(event) => {
                    handleEditMetadataValue(event.target.value);
                }}
                value={value}
                variant="outlined"
                sx={EditMetadataValueStyles.textfield}
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

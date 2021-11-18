import { TextField } from '@mui/material';
import { ChangeEvent } from 'react';
import { IEditAnalysisDetails } from '../..';
import EditAnalysisDetailsStyles from './EditAnalysisDetails.styles';

const EditAnalysisDetails: React.FC<IEditAnalysisDetails> = (props) => {
    const textFieldInputProps = {
        style: {
            fontSize: 15,
        },
    };

    const handleChange = (event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        props.onEditAnalysisDetails(event.target.name, event.target.value);
    };

    return (
        <>
            <TextField
                sx={EditAnalysisDetailsStyles.textfield}
                variant="outlined"
                label="Edit Analysis Name"
                value={props.name || ''}
                InputProps={textFieldInputProps}
                name="name"
                onChange={handleChange}
            />
            <TextField
                sx={EditAnalysisDetailsStyles.textfield}
                variant="outlined"
                label="Edit Analysis Description"
                value={props.description || ''}
                InputProps={textFieldInputProps}
                name="description"
                multiline
                onChange={handleChange}
            />
        </>
    );
};

export default EditAnalysisDetails;

import { TextField } from '@mui/material';
import React, { ChangeEvent } from 'react';
import EditStudyDetailsStyles from './EditStudyDetails.styles';

export interface IStudyEditDetails {
    name: string;
    authors: string;
    publication: string;
    doi: string;
    description: string;

    onEdit: (arg: { key: string; value: string }) => void;
}

const EditStudyDetails: React.FC<IStudyEditDetails> = React.memo((props) => {
    const textFieldInputProps = {
        style: {
            fontSize: 15,
        },
    };

    const handleOnEdit = (event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        props.onEdit({
            key: event.target.name,
            value: event.target.value,
        });
    };

    return (
        <>
            <TextField
                label="Edit Title"
                variant="outlined"
                sx={EditStudyDetailsStyles.textfield}
                value={props.name}
                InputProps={textFieldInputProps}
                name="name"
                onChange={handleOnEdit}
            />
            <TextField
                label="Edit Authors"
                sx={EditStudyDetailsStyles.textfield}
                variant="outlined"
                value={props.authors}
                InputProps={textFieldInputProps}
                name="authors"
                onChange={handleOnEdit}
            />
            <TextField
                label="Edit Journal"
                variant="outlined"
                sx={EditStudyDetailsStyles.textfield}
                value={props.publication}
                InputProps={textFieldInputProps}
                name="publication"
                onChange={handleOnEdit}
            />
            <TextField
                label="Edit DOI"
                variant="outlined"
                sx={EditStudyDetailsStyles.textfield}
                value={props.doi}
                InputProps={textFieldInputProps}
                name="doi"
                onChange={handleOnEdit}
            />
            <TextField
                label="Edit Description"
                variant="outlined"
                sx={EditStudyDetailsStyles.textfield}
                multiline
                value={props.description}
                InputProps={textFieldInputProps}
                name="description"
                onChange={handleOnEdit}
            />
        </>
    );
});

export default EditStudyDetails;

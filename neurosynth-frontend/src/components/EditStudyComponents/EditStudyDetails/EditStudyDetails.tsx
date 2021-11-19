import { useAuth0 } from '@auth0/auth0-react';
import { ExpandMoreOutlined } from '@mui/icons-material';
import {
    TextField,
    Button,
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Typography,
} from '@mui/material';
import { AxiosError } from 'axios';
import React, { ChangeEvent, useContext, useState } from 'react';
import { GlobalContext, SnackbarType } from '../../../contexts/GlobalContext';
import API from '../../../utils/api';
import EditStudyDetailsStyles from './EditStudyDetails.styles';

export interface IStudyEditDetailsProperties {
    studyId: string;
    name: string;
    authors: string;
    publication: string;
    doi: string;
    description: string;
}

export interface IStudyEditDetails extends IStudyEditDetailsProperties {
    onEditStudyDetails: (update: { key: string; value: string }) => void;
}

const EditStudyDetails: React.FC<IStudyEditDetails> = React.memo((props) => {
    const { getAccessTokenSilently } = useAuth0();
    const context = useContext(GlobalContext);
    const [updatedEnabled, setUpdateEnabled] = useState(false);

    const textFieldInputProps = {
        style: {
            fontSize: 15,
        },
    };

    const handleOnEdit = (event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        props.onEditStudyDetails({
            key: event.target.name,
            value: event.target.value,
        });
        setUpdateEnabled(true);
    };

    const handleOnUpdate = async (event: React.MouseEvent) => {
        try {
            const token = await getAccessTokenSilently();
            context.handleToken(token);
        } catch (exception) {
            context.showSnackbar('there was an error', SnackbarType.ERROR);
            console.error(exception);
        }

        API.Services.StudiesService.studiesIdPut(props.studyId, {
            name: props.name,
            description: props.description,
            authors: props.authors,
            publication: props.publication,
            doi: props.doi,
        })
            .then((res) => {
                setUpdateEnabled(false);
                context.showSnackbar('study successfully updated', SnackbarType.SUCCESS);
                // trigger a reload by passing in a reference to an empty object
            })
            .catch((err: Error | AxiosError) => {
                context.showSnackbar('there was an error', SnackbarType.ERROR);
                console.error(err.message);
            });
    };

    return (
        <>
            <Accordion
                sx={updatedEnabled ? EditStudyDetailsStyles.unsavedChanges : {}}
                elevation={1}
            >
                <AccordionSummary
                    sx={EditStudyDetailsStyles.accordionSummary}
                    expandIcon={<ExpandMoreOutlined />}
                >
                    <Typography variant="h6">
                        <b>Edit Study Details</b>
                    </Typography>
                </AccordionSummary>
                <AccordionDetails>
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
                    <Button
                        disabled={!updatedEnabled}
                        onClick={handleOnUpdate}
                        color="secondary"
                        variant="contained"
                        sx={EditStudyDetailsStyles.button}
                    >
                        <b>Update Study Details</b>
                    </Button>
                </AccordionDetails>
            </Accordion>
        </>
    );
});

export default EditStudyDetails;

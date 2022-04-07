import { useAuth0 } from '@auth0/auth0-react';
import { ExpandMoreOutlined } from '@mui/icons-material';
import {
    TextField,
    Button,
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Typography,
    Box,
} from '@mui/material';
import { AxiosError } from 'axios';
import React, { ChangeEvent, useContext, useState } from 'react';
import { GlobalContext, SnackbarType } from '../../../contexts/GlobalContext';
import useIsMounted from '../../../hooks/useIsMounted';
import API from '../../../utils/api';
import EditStudyDetailsStyles from './EditStudyDetails.styles';

export interface IEditStudyDetails {
    studyId: string;
    name: string;
    authors: string;
    publication: string;
    doi: string;
    description: string;
}

const textFieldInputProps = {
    style: {
        fontSize: 15,
    },
};

const EditStudyDetails: React.FC<IEditStudyDetails> = React.memo((props) => {
    const { studyId, name, authors, publication, doi, description } = props;
    const { getAccessTokenSilently } = useAuth0();
    const context = useContext(GlobalContext);
    const [updatedEnabled, setUpdateEnabled] = useState(false);
    const isMountedRef = useIsMounted();

    // save original details for revert behavior
    const [originalDetails, setOriginalDetails] = useState<IEditStudyDetails>({
        studyId: studyId,
        name: name,
        authors: authors,
        publication: publication,
        doi: doi,
        description: description,
    });

    const [details, setDetails] = useState<IEditStudyDetails>({
        studyId: studyId,
        name: name,
        authors: authors,
        publication: publication,
        doi: doi,
        description: description,
    });

    const handleOnEdit = (event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        setDetails((prevState) => ({
            ...prevState,
            [event.target.name]: event.target.value,
        }));
        setUpdateEnabled(true);
    };

    const handleOnSave = async (_event: React.MouseEvent) => {
        try {
            const token = await getAccessTokenSilently();
            API.UpdateServicesWithToken(token);
        } catch (exception) {
            context.showSnackbar('there was an error', SnackbarType.ERROR);
            console.error(exception);
        }

        API.Services.StudiesService.studiesIdPut(props.studyId, {
            name: details.name,
            description: details.description,
            authors: details.authors,
            publication: details.publication,
            doi: details.doi,
        })
            .then((_res) => {
                context.showSnackbar('study successfully updated', SnackbarType.SUCCESS);
                if (isMountedRef.current) {
                    setUpdateEnabled(false);
                    setOriginalDetails({ ...details });
                }
            })
            .catch((err: Error | AxiosError) => {
                context.showSnackbar('there was an error', SnackbarType.ERROR);
                console.error(err.message);
            });
    };

    const handleRevertChanges = (event: React.MouseEvent) => {
        setDetails({ ...originalDetails });
        setUpdateEnabled(false);
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
                    <Box sx={EditStudyDetailsStyles.accordionTitleContainer}>
                        <Typography variant="h6">
                            <b>Edit Study Details</b>
                        </Typography>
                        {updatedEnabled && (
                            <Typography color="secondary" variant="body2">
                                unsaved changes
                            </Typography>
                        )}
                    </Box>
                </AccordionSummary>
                <AccordionDetails>
                    <TextField
                        label="Edit Title"
                        variant="outlined"
                        sx={EditStudyDetailsStyles.textfield}
                        value={details.name}
                        InputProps={textFieldInputProps}
                        name="name"
                        onChange={handleOnEdit}
                    />
                    <TextField
                        label="Edit Authors"
                        sx={EditStudyDetailsStyles.textfield}
                        variant="outlined"
                        value={details.authors}
                        InputProps={textFieldInputProps}
                        name="authors"
                        onChange={handleOnEdit}
                    />
                    <TextField
                        label="Edit Journal"
                        variant="outlined"
                        sx={EditStudyDetailsStyles.textfield}
                        value={details.publication}
                        InputProps={textFieldInputProps}
                        name="publication"
                        onChange={handleOnEdit}
                    />
                    <TextField
                        label="Edit DOI"
                        variant="outlined"
                        sx={EditStudyDetailsStyles.textfield}
                        value={details.doi}
                        InputProps={textFieldInputProps}
                        name="doi"
                        onChange={handleOnEdit}
                    />
                    <TextField
                        label="Edit Description"
                        variant="outlined"
                        sx={EditStudyDetailsStyles.textfield}
                        multiline
                        value={details.description}
                        InputProps={textFieldInputProps}
                        name="description"
                        onChange={handleOnEdit}
                    />
                    <Button
                        disabled={!updatedEnabled}
                        onClick={handleOnSave}
                        color="success"
                        variant="contained"
                        sx={[EditStudyDetailsStyles.button, { marginRight: '15px' }]}
                    >
                        Save
                    </Button>
                    <Button
                        disabled={!updatedEnabled}
                        onClick={handleRevertChanges}
                        color="secondary"
                        variant="outlined"
                        sx={EditStudyDetailsStyles.button}
                    >
                        Cancel
                    </Button>
                </AccordionDetails>
            </Accordion>
        </>
    );
});

export default EditStudyDetails;

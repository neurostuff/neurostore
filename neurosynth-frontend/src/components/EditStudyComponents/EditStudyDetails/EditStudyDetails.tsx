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
import React, { ChangeEvent, useContext, useEffect, useState } from 'react';
import { GlobalContext, SnackbarType } from '../../../contexts/GlobalContext';
import useIsMounted from '../../../hooks/useIsMounted';
import API from '../../../utils/api';
import EditStudyDetailsStyles from './EditStudyDetails.styles';

export interface IEditStudyDetailsProperties {
    studyId: string;
    name: string;
    authors: string;
    publication: string;
    doi: string;
    description: string;
}

export interface IEditStudyDetails extends IEditStudyDetailsProperties {
    onEditStudyDetails: (update: { [key: string]: string }) => void;
}

const EditStudyDetails: React.FC<IEditStudyDetails> = React.memo((props) => {
    const { studyId, name, authors, publication, doi, description } = props;
    const { getAccessTokenSilently } = useAuth0();
    const context = useContext(GlobalContext);
    const [updatedEnabled, setUpdateEnabled] = useState(false);
    const isMountedRef = useIsMounted();
    const [originalDetails, setOriginalDetails] = useState<IEditStudyDetailsProperties>({
        studyId: studyId,
        name: name,
        authors: authors,
        publication: publication,
        doi: doi,
        description: description,
    });

    const textFieldInputProps = {
        style: {
            fontSize: 15,
        },
    };

    // set original details without updating in the future
    useEffect(() => {
        setOriginalDetails({
            studyId: studyId,
            name: name,
            authors: authors,
            publication: publication,
            doi: doi,
            description: description,
        });
    }, [studyId, name, authors, publication, doi, description]);

    const handleOnEdit = (event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        props.onEditStudyDetails({
            [event.target.name]: event.target.value,
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
                context.showSnackbar('study successfully updated', SnackbarType.SUCCESS);
                if (isMountedRef.current) {
                    setUpdateEnabled(false);
                    setOriginalDetails({
                        studyId: props.studyId,
                        name: props.name,
                        description: props.description,
                        authors: props.authors,
                        publication: props.publication,
                        doi: props.doi,
                    });
                }
            })
            .catch((err: Error | AxiosError) => {
                context.showSnackbar('there was an error', SnackbarType.ERROR);
                console.error(err.message);
            });
    };

    const handleRevertChanges = (event: React.MouseEvent) => {
        props.onEditStudyDetails({ ...originalDetails });
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
                        color="success"
                        variant="contained"
                        sx={{ ...EditStudyDetailsStyles.button, marginRight: '15px' }}
                    >
                        Update
                    </Button>
                    <Button
                        disabled={!updatedEnabled}
                        onClick={handleRevertChanges}
                        color="secondary"
                        variant="outlined"
                        sx={EditStudyDetailsStyles.button}
                    >
                        Revert Changes
                    </Button>
                </AccordionDetails>
            </Accordion>
        </>
    );
});

export default EditStudyDetails;

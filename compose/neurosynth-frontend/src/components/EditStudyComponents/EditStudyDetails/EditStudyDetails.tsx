import { TextField, Button, Typography, Box } from '@mui/material';
import { AxiosError } from 'axios';
import React, { ChangeEvent, useState } from 'react';
import { useIsMounted } from 'hooks';
import API from 'utils/api';
import NeurosynthAccordion from '../../NeurosynthAccordion/NeurosynthAccordion';
import EditStudyDetailsStyles from './EditStudyDetails.styles';
import EditStudyMetadataStyles from '../EditStudyMetadata/EditStudyMetadata.styles';
import { useSnackbar } from 'notistack';

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
    const { enqueueSnackbar } = useSnackbar();
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
        API.NeurostoreServices.StudiesService.studiesIdPut(props.studyId, {
            name: details.name,
            description: details.description,
            authors: details.authors,
            publication: details.publication,
            doi: details.doi,
        })
            .then((_res) => {
                enqueueSnackbar('study updated successfully', { variant: 'success' });
                if (isMountedRef.current) {
                    setUpdateEnabled(false);
                    setOriginalDetails({ ...details });
                }
            })
            .catch((err: Error | AxiosError) => {
                enqueueSnackbar('there was an error updating the study', { variant: 'error' });
                console.error(err.message);
            });
    };

    const handleRevertChanges = (event: React.MouseEvent) => {
        setDetails({ ...originalDetails });
        setUpdateEnabled(false);
    };

    return (
        <NeurosynthAccordion
            TitleElement={
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
            }
            accordionSummarySx={EditStudyMetadataStyles.accordionSummary}
            sx={updatedEnabled ? EditStudyDetailsStyles.unsavedChanges : {}}
            elevation={1}
        >
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
        </NeurosynthAccordion>
    );
});

export default EditStudyDetails;

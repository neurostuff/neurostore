import { TextField, Button, Typography, Box } from '@mui/material';
import React, { ChangeEvent, useState } from 'react';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import EditStudyDetailsStyles from 'components/EditStudyComponents/EditStudyDetails/EditStudyDetails.styles';
import EditStudyMetadataStyles from 'components/EditMetadata/EditMetadata.styles';
import { useUpdateStudy } from 'hooks';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';

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
    const [updatedEnabled, setUpdateEnabled] = useState(false);
    const { isLoading, mutate } = useUpdateStudy();

    // save original details for revert behavior
    const [originalDetails, setOriginalDetails] = useState<IEditStudyDetails>({ ...props });

    const [details, setDetails] = useState<IEditStudyDetails>({ ...props });

    const handleOnEdit = (event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        setDetails((prevState) => ({
            ...prevState,
            [event.target.name]: event.target.value,
        }));
        setUpdateEnabled(true);
    };

    const handleOnSave = () => {
        mutate(
            {
                studyId: props.studyId,
                study: {
                    name: details.name,
                    authors: details.authors,
                    publication: details.publication,
                    doi: details.doi,
                    description: details.description,
                },
            },
            {
                onSuccess: () => {
                    setUpdateEnabled(false);
                    setOriginalDetails({ ...details });
                },
            }
        );
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
            <LoadingButton
                disabled={!updatedEnabled}
                isLoading={isLoading}
                onClick={handleOnSave}
                color="success"
                variant="contained"
                text="Save"
                sx={{ ...EditStudyDetailsStyles.button, marginRight: '15px' }}
            />
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

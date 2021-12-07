import { useAuth0 } from '@auth0/auth0-react';
import { Box, Button, TextField } from '@mui/material';
import { AxiosError } from 'axios';
import React, { ChangeEvent, useContext, useEffect, useState } from 'react';
import { IEditAnalysisDetails } from '../..';
import { GlobalContext, SnackbarType } from '../../../../../contexts/GlobalContext';
import API from '../../../../../utils/api';
import EditAnalysisDetailsStyles from './EditAnalysisDetails.styles';

const EditAnalysisDetails: React.FC<IEditAnalysisDetails> = (props) => {
    const [originalDetails, setOriginalDetails] = useState({
        name: '',
        description: '',
    });
    const [updatedEnabled, setUpdateEnabled] = useState({
        name: false,
        description: false,
    });
    const context = useContext(GlobalContext);
    const { getAccessTokenSilently } = useAuth0();

    // as this saves the original details, we only want it to run once in the beginning to save the data in local memory
    useEffect(() => {
        setOriginalDetails({
            name: props.name,
            description: props.description,
        });
    }, [props.name, props.description]);

    const textFieldInputProps = {
        style: {
            fontSize: 15,
        },
    };

    const handleChange = (event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        setUpdateEnabled((prevState) => ({
            ...prevState,
            [event.target.name]: true,
        }));
        props.onEditAnalysisDetails({
            [event.target.name]: event.target.value,
        });
    };

    const handleUpdateAnalysis = async (event: React.MouseEvent) => {
        try {
            const token = await getAccessTokenSilently();
            context.handleToken(token);
        } catch (exception) {
            context.showSnackbar('there was an error', SnackbarType.ERROR);
            console.error(exception);
        }

        API.Services.AnalysesService.analysesIdPut(props.analysisId, {
            name: props.name,
            description: props.description,
        })
            .then((res) => {
                setUpdateEnabled({
                    name: false,
                    description: false,
                });
                setOriginalDetails({
                    name: props.name || '',
                    description: props.description || '',
                });
                context.showSnackbar('analysis successfully updated', SnackbarType.SUCCESS);
                // trigger a reload by passing in a reference to an empty object
            })
            .catch((err: Error | AxiosError) => {
                context.showSnackbar('there was an error', SnackbarType.ERROR);
                console.error(err.message);
            });
    };

    const handleRevertChanges = (event: React.MouseEvent) => {
        setUpdateEnabled({
            name: false,
            description: false,
        });
        props.onEditAnalysisDetails({ ...originalDetails });
    };

    return (
        <Box>
            <TextField
                sx={{
                    ...EditAnalysisDetailsStyles.textfield,
                    ...(updatedEnabled.name ? EditAnalysisDetailsStyles.unsavedChanges : {}),
                }}
                variant="outlined"
                label="Edit Analysis Name"
                value={props.name || ''}
                InputProps={textFieldInputProps}
                name="name"
                onChange={handleChange}
            />
            <TextField
                sx={{
                    ...EditAnalysisDetailsStyles.textfield,
                    ...(updatedEnabled.description ? EditAnalysisDetailsStyles.unsavedChanges : {}),
                }}
                variant="outlined"
                label="Edit Analysis Description"
                value={props.description || ''}
                InputProps={textFieldInputProps}
                name="description"
                multiline
                onChange={handleChange}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box>
                    <Button
                        sx={{ ...EditAnalysisDetailsStyles.button, marginRight: '15px' }}
                        variant="contained"
                        color="success"
                        onClick={handleUpdateAnalysis}
                        disabled={!(updatedEnabled.name || updatedEnabled.description)}
                    >
                        Update
                    </Button>
                    <Button
                        sx={EditAnalysisDetailsStyles.button}
                        color="secondary"
                        disabled={!(updatedEnabled.name || updatedEnabled.description)}
                        variant="outlined"
                        onClick={handleRevertChanges}
                    >
                        Revert Changes
                    </Button>
                </Box>
                <Button
                    sx={EditAnalysisDetailsStyles.button}
                    color="error"
                    variant="contained"
                    onClick={() => props.onDeleteAnalysis(props.analysisId)}
                >
                    Delete this analysis
                </Button>
            </Box>
        </Box>
    );
};

export default EditAnalysisDetails;

import { useAuth0 } from '@auth0/auth0-react';
import { Box, Button, TextField } from '@mui/material';
import { AxiosError } from 'axios';
import React, { ChangeEvent, useContext, useState } from 'react';
import { IEditAnalysisDetails } from '../..';
import { GlobalContext, SnackbarType } from '../../../../../contexts/GlobalContext';
import useIsMounted from '../../../../../hooks/useIsMounted';
import API from '../../../../../utils/api';
import EditAnalysisDetailsStyles from './EditAnalysisDetails.styles';
import EditAnalysisStyles from '../EditAnalysis.styles';

const EditAnalysisDetails: React.FC<IEditAnalysisDetails> = React.memo((props) => {
    const [originalDetails, setOriginalDetails] = useState({
        name: props.name,
        description: props.description,
    });
    const [updatedEnabled, setUpdateEnabled] = useState({
        name: false,
        description: false,
    });
    const context = useContext(GlobalContext);
    const isMountedRef = useIsMounted();
    const { getAccessTokenSilently } = useAuth0();

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
            API.UpdateServicesWithToken(token);
        } catch (exception) {
            context.showSnackbar('there was an error', SnackbarType.ERROR);
            console.error(exception);
        }

        API.Services.AnalysesService.analysesIdPut(props.analysisId, {
            name: props.name,
            description: props.description,
        })
            .then((res) => {
                if (isMountedRef.current) {
                    setUpdateEnabled({
                        name: false,
                        description: false,
                    });
                    setOriginalDetails({
                        name: props.name || '',
                        description: props.description || '',
                    });
                }
                context.showSnackbar('analysis successfully updated', SnackbarType.SUCCESS);
                // trigger a reload by passing in a reference to an empty object
            })
            .catch((err: Error | AxiosError) => {
                context.showSnackbar('there was an error', SnackbarType.ERROR);
                console.error(err.message);
            });
    };

    const handleRevertChanges = (event: React.MouseEvent) => {
        props.onEditAnalysisDetails({ ...originalDetails });
        setUpdateEnabled({
            name: false,
            description: false,
        });
    };

    return (
        <Box>
            <TextField
                sx={[
                    EditAnalysisDetailsStyles.textfield,
                    updatedEnabled.name ? EditAnalysisDetailsStyles.unsavedChanges : {},
                ]}
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
                        sx={[EditAnalysisStyles.analysisButton, { marginRight: '15px' }]}
                        variant="contained"
                        color="success"
                        onClick={handleUpdateAnalysis}
                        disabled={!(updatedEnabled.name || updatedEnabled.description)}
                    >
                        Update
                    </Button>
                    <Button
                        sx={[EditAnalysisStyles.analysisButton, { marginRight: '15px' }]}
                        variant="outlined"
                        color="secondary"
                        onClick={handleRevertChanges}
                        disabled={!(updatedEnabled.name || updatedEnabled.description)}
                    >
                        Cancel
                    </Button>
                </Box>
                <Button
                    sx={EditAnalysisStyles.analysisButton}
                    color="error"
                    variant="contained"
                    onClick={() => props.onDeleteAnalysis(props.analysisId)}
                >
                    Delete this analysis
                </Button>
            </Box>
        </Box>
    );
});

export default EditAnalysisDetails;

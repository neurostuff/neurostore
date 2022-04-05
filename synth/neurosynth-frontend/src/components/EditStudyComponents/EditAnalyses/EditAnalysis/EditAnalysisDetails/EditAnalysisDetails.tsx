import { Box, Button, TextField } from '@mui/material';
import React, { ChangeEvent } from 'react';
import { EAnalysisEdit, EAnalysisEditButtonType, IEditAnalysisDetails } from '../..';
import EditAnalysisDetailsStyles from './EditAnalysisDetails.styles';
import EditAnalysisStyles from '../EditAnalysis.styles';

const EditAnalysisDetails: React.FC<IEditAnalysisDetails> = React.memo((props) => {
    const textFieldInputProps = {
        style: {
            fontSize: 15,
        },
    };

    const handleChange = (event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        props.onEditAnalysisDetails(
            event.target.name as 'name' | 'description',
            event.target.value
        );
    };

    return (
        <Box>
            <TextField
                sx={[
                    EditAnalysisDetailsStyles.textfield,
                    props.updateEnabled.name ? EditAnalysisDetailsStyles.unsavedChanges : {},
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
                    ...(props.updateEnabled.description
                        ? EditAnalysisDetailsStyles.unsavedChanges
                        : {}),
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
                        onClick={(_event) =>
                            props.onEditAnalysisButtonPress(
                                EAnalysisEdit.DETAILS,
                                EAnalysisEditButtonType.SAVE
                            )
                        }
                        disabled={!(props.updateEnabled.name || props.updateEnabled.description)}
                    >
                        Save
                    </Button>
                    <Button
                        sx={[EditAnalysisStyles.analysisButton, { marginRight: '15px' }]}
                        variant="outlined"
                        color="secondary"
                        onClick={(_event) =>
                            props.onEditAnalysisButtonPress(
                                EAnalysisEdit.DETAILS,
                                EAnalysisEditButtonType.CANCEL
                            )
                        }
                        disabled={!(props.updateEnabled.name || props.updateEnabled.description)}
                    >
                        Cancel
                    </Button>
                </Box>
                <Button
                    sx={EditAnalysisStyles.analysisButton}
                    color="error"
                    variant="contained"
                    onClick={(_event) =>
                        props.onEditAnalysisButtonPress(
                            EAnalysisEdit.DETAILS,
                            EAnalysisEditButtonType.DELETE
                        )
                    }
                >
                    Delete this analysis
                </Button>
            </Box>
        </Box>
    );
});

export default EditAnalysisDetails;

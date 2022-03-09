import { Typography, Button, Box, Paper } from '@mui/material';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useParams } from 'react-router';
import API, { AnnotationsApiResponse } from '../../../utils/api';
import {
    ConfirmationDialog,
    TextEdit,
    NeurosynthSpreadsheet,
    EPropertyType,
} from '../../../components';
import EditStudyPageStyles from '../../Studies/EditStudyPage/EditStudyPage.styles';
import EditAnnotationsPageStyles from './EditAnnotationsPage.styles';
import { useAuth0 } from '@auth0/auth0-react';
import { GlobalContext, SnackbarType } from '../../../contexts/GlobalContext';
import { AnnotationNote } from '../../../gen/api';

const EditAnnotationsPage: React.FC = (props) => {
    const history = useHistory();
    const { isAuthenticated, getAccessTokenSilently } = useAuth0();
    const { handleToken, showSnackbar } = useContext(GlobalContext);

    const [confirmationIsOpen, setConfirmationIsOpen] = useState(false);
    const [annotation, setAnnotation] = useState<AnnotationsApiResponse>();

    const params: {
        annotationId: string;
        datasetId: string;
    } = useParams();

    useEffect(() => {
        const getAnnotation = () => {
            API.Services.AnnotationsService.annotationsIdGet(params.annotationId).then((res) => {
                setAnnotation(res.data);
            });
        };
        getAnnotation();
    }, [params.annotationId]);

    const updateAnnotationDetails = async (
        property: 'name' | 'description',
        updatedText: string
    ) => {
        try {
            const token = await getAccessTokenSilently();
            handleToken(token);
        } catch (exception) {
            showSnackbar('there was an error', SnackbarType.ERROR);
            console.error(exception);
        }

        API.Services.AnnotationsService.annotationsIdPut(params.annotationId, {
            [property]: updatedText,
            notes: (annotation?.notes || []).map((annotationNote) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { study_name, analysis_name, note, analysis, ...everythingElse } =
                    annotationNote;
                return {
                    analysis,
                    note,
                };
            }), // we get a 500 error if we do not include notes
        })
            .then((res) => {
                setAnnotation((prevState) => {
                    if (!prevState) return prevState;
                    return {
                        ...prevState,
                        [property]: res.data[property],
                    };
                });
                showSnackbar(`updated the annotation ${property}`, SnackbarType.SUCCESS);
            })
            .catch((err) => {
                console.error(err);
                showSnackbar(
                    `there was an error updating the annotation ${property}`,
                    SnackbarType.ERROR
                );
            });
    };

    const handleOnCancel = (event: React.MouseEvent) => {
        history.push(`/datasets/${params.datasetId}`);
    };

    const handleCloseConfirmationDialog = async (confirm: boolean | undefined) => {
        setConfirmationIsOpen(false);

        if (confirm && annotation && annotation.id) {
            try {
                const token = await getAccessTokenSilently();
                handleToken(token);
            } catch (exception) {
                showSnackbar('there was an error', SnackbarType.ERROR);
                console.error(exception);
            }
            API.Services.AnnotationsService.annotationsIdDelete(annotation.id)
                .then(() => {
                    history.push(`/datasets/${params.datasetId}`);
                    showSnackbar('deleted annotation', SnackbarType.SUCCESS);
                })
                .catch((err) => {
                    console.error(err);
                    showSnackbar('there was an error deleting the annotation', SnackbarType.ERROR);
                });
        }
    };

    const handleSaveAnnotation = useCallback(
        async (
            annotationNotes: AnnotationNote[],
            noteKeyTypes: { [key: string]: EPropertyType }
        ) => {
            try {
                const token = await getAccessTokenSilently();
                handleToken(token);
            } catch (exception) {
                showSnackbar('there was an error', SnackbarType.ERROR);
                console.error(exception);
            }

            API.Services.AnnotationsService.annotationsIdPut(params.annotationId, {
                notes: annotationNotes.map((annotationNote) => ({
                    note: annotationNote.note,
                    analysis: annotationNote.analysis,
                    study: annotationNote.study,
                })),
                note_keys: noteKeyTypes,
            })
                .then((res) => {
                    showSnackbar('annotation successfully updated', SnackbarType.SUCCESS);
                })
                .catch((err) => {
                    showSnackbar('there was an error updating the annotation', SnackbarType.ERROR);
                    console.error(err);
                });
        },
        [getAccessTokenSilently, handleToken, params.annotationId, showSnackbar]
    );

    return (
        <>
            <Box sx={EditAnnotationsPageStyles.stickyButtonContainer}>
                <Button
                    color="error"
                    onClick={handleOnCancel}
                    sx={EditStudyPageStyles.button}
                    variant="outlined"
                >
                    Return to Dataset View
                </Button>
            </Box>

            <Box sx={{ marginBottom: '0.5rem' }}>
                <TextEdit
                    onSave={(updatedText) => updateAnnotationDetails('name', updatedText)}
                    textToEdit={annotation?.name || ''}
                    sx={{ fontSize: '1.5rem' }}
                >
                    <Typography variant="h5">
                        {annotation?.name || (
                            <Box component="span" sx={{ color: 'warning.dark' }}>
                                No name
                            </Box>
                        )}
                    </Typography>
                </TextEdit>
                <TextEdit
                    onSave={(updatedText) => updateAnnotationDetails('description', updatedText)}
                    textToEdit={annotation?.description || ''}
                >
                    <Typography>
                        {annotation?.description || (
                            <Box component="span" sx={{ color: 'warning.dark' }}>
                                No description
                            </Box>
                        )}
                    </Typography>
                </TextEdit>
            </Box>

            <Box component={Paper} sx={EditAnnotationsPageStyles.spreadsheetContainer}>
                <NeurosynthSpreadsheet
                    annotationNotes={annotation?.notes}
                    annotationNoteKeyTypes={annotation?.note_keys}
                    onSaveAnnotation={handleSaveAnnotation}
                />
            </Box>

            <Button
                onClick={() => setConfirmationIsOpen(true)}
                color="error"
                variant="contained"
                disabled={!isAuthenticated}
                sx={{ ...EditStudyPageStyles.button, marginTop: '0.5rem' }}
            >
                Delete this annotation
            </Button>
            <ConfirmationDialog
                message="Are you sure you want to delete this annotation?"
                confirmText="Yes"
                rejectText="No"
                isOpen={confirmationIsOpen}
                onCloseDialog={handleCloseConfirmationDialog}
            />
        </>
    );
};

export default EditAnnotationsPage;

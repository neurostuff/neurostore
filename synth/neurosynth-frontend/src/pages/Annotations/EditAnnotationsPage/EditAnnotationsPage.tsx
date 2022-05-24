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
    BackButton,
} from 'components';
import EditStudyPageStyles from '../../Studies/EditStudyPage/EditStudyPage.styles';
import EditAnnotationsPageStyles from './EditAnnotationsPage.styles';
import { useAuth0 } from '@auth0/auth0-react';
import { GlobalContext, SnackbarType } from '../../../contexts/GlobalContext';
import { AnnotationNote } from '../../../neurostore-typescript-sdk';
import { AxiosResponse } from 'axios';

const EditAnnotationsPage: React.FC = (props) => {
    const history = useHistory();
    const { isAuthenticated } = useAuth0();
    const { showSnackbar } = useContext(GlobalContext);

    const [confirmationIsOpen, setConfirmationIsOpen] = useState(false);
    const [annotation, setAnnotation] = useState<AnnotationsApiResponse>();

    const params: {
        annotationId: string;
        studysetId: string;
    } = useParams();

    useEffect(() => {
        const getAnnotation = () => {
            API.NeurostoreServices.AnnotationsService.annotationsIdGet(params.annotationId).then(
                (res) => {
                    setAnnotation(res.data);
                }
            );
        };
        getAnnotation();
    }, [params.annotationId]);

    const updateAnnotationDetails = async (property: string, updatedText: string) => {
        API.NeurostoreServices.AnnotationsService.annotationsIdPut(params.annotationId, {
            [property]: updatedText,
        })
            .then((res: AxiosResponse<AnnotationsApiResponse>) => {
                setAnnotation((prevState) => {
                    if (!prevState) return prevState;
                    return {
                        ...prevState,
                        [property]: res.data[property as 'name' | 'description'],
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

    const handleCloseConfirmationDialog = async (confirm: boolean | undefined) => {
        setConfirmationIsOpen(false);

        if (confirm && annotation && annotation.id) {
            API.NeurostoreServices.AnnotationsService.annotationsIdDelete(annotation.id)
                .then(() => {
                    history.push(`/studysets/${params.studysetId}`);
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
            API.NeurostoreServices.AnnotationsService.annotationsIdPut(params.annotationId, {
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
        [params.annotationId, showSnackbar]
    );

    return (
        <>
            <Box sx={{ marginBottom: '1rem' }}>
                <BackButton text="Return to studyset" path={`/studysets/${params.studysetId}`} />
            </Box>

            <Box sx={{ marginBottom: '1rem' }}>
                <TextEdit
                    onSave={(updatedText, label) => updateAnnotationDetails(label, updatedText)}
                    textToEdit={annotation?.name || ''}
                    label="name"
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
                    label="description"
                    onSave={(updatedText, label) => updateAnnotationDetails(label, updatedText)}
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
                sx={[EditStudyPageStyles.button, { marginTop: '1rem' }]}
            >
                Delete this annotation
            </Button>
            <ConfirmationDialog
                dialogTitle="Are you sure you want to delete this annotation?"
                confirmText="Yes"
                rejectText="No"
                isOpen={confirmationIsOpen}
                onCloseDialog={handleCloseConfirmationDialog}
            />
        </>
    );
};

export default EditAnnotationsPage;

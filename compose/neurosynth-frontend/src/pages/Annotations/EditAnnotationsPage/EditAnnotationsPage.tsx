import { Typography, Button, Box, Paper } from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useParams } from 'react-router';
import API, { AnnotationsApiResponse } from 'utils/api';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog/ConfirmationDialog';
import TextEdit from 'components/TextEdit/TextEdit';
import BackButton from 'components/Buttons/BackButton/BackButton';
import NeurosynthSpreadsheet from 'components/NeurosynthSpreadsheet/NeurosynthSpreadsheet';
import { EPropertyType } from 'components/EditMetadata';
import EditStudyPageStyles from '../../Studies/EditStudyPage/EditStudyPage.styles';
import EditAnnotationsPageStyles from './EditAnnotationsPage.styles';
import { useAuth0 } from '@auth0/auth0-react';
import { AnnotationNote } from '../../../neurostore-typescript-sdk';
import { AxiosResponse } from 'axios';
import { registerEditor, NumericEditor, TextEditor, BaseEditor } from 'handsontable/editors';
import {
    baseRenderer,
    registerRenderer,
    htmlRenderer,
    numericRenderer,
    textRenderer,
} from 'handsontable/renderers';
import { registerValidator, numericValidator } from 'handsontable/validators';
import {
    registerCellType,
    HandsontableCellType,
    NumericCellType,
    TextCellType,
} from 'handsontable/cellTypes';
import {
    CopyPaste,
    MergeCells,
    MultipleSelectionHandles,
    registerPlugin,
    DragToScroll,
    UndoRedo,
    BasePlugin,
} from 'handsontable/plugins';
import { useSnackbar } from 'notistack';

registerEditor(BaseEditor);
registerEditor(NumericEditor);
registerEditor(TextEditor);

registerRenderer(baseRenderer);
registerRenderer(htmlRenderer);
registerRenderer(numericRenderer);
registerRenderer(textRenderer);

registerValidator(numericValidator);

registerCellType(HandsontableCellType);
registerCellType(NumericCellType);
registerCellType(TextCellType);

registerPlugin(CopyPaste);
registerPlugin(MergeCells);
registerPlugin(DragToScroll);
registerPlugin(MultipleSelectionHandles);
registerPlugin(UndoRedo);
registerPlugin(BasePlugin);

const EditAnnotationsPage: React.FC = (props) => {
    const history = useHistory();
    const { isAuthenticated } = useAuth0();
    const { enqueueSnackbar } = useSnackbar();

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
                enqueueSnackbar(`updated the annotation ${property} successfully`, {
                    variant: 'success',
                });
            })
            .catch((err) => {
                enqueueSnackbar(`there was an error updating the annotatino ${property}`, {
                    variant: 'error',
                });
            });
    };

    const handleCloseConfirmationDialog = async (confirm: boolean | undefined) => {
        setConfirmationIsOpen(false);

        if (confirm && annotation && annotation.id) {
            API.NeurostoreServices.AnnotationsService.annotationsIdDelete(annotation.id)
                .then(() => {
                    history.push(`/studysets/${params.studysetId}`);
                    enqueueSnackbar('deleted annotation successfully', { variant: 'success' });
                })
                .catch((err) => {
                    enqueueSnackbar('there was an error deleting the annotation', {
                        variant: 'error',
                    });
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
                    enqueueSnackbar('annotation updated successfully', { variant: 'success' });
                })
                .catch((err) => {
                    enqueueSnackbar('there was an error updating the annotation', {
                        variant: 'error',
                    });
                });
        },
        [params.annotationId, enqueueSnackbar]
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

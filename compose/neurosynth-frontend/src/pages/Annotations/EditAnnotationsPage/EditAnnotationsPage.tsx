import { Typography, Box, Paper } from '@mui/material';
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useParams } from 'react-router';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog/ConfirmationDialog';
import TextEdit from 'components/TextEdit/TextEdit';
import BackButton from 'components/Buttons/BackButton/BackButton';
import NeurosynthSpreadsheet from 'components/NeurosynthSpreadsheet/NeurosynthSpreadsheet';
import { EPropertyType } from 'components/EditMetadata';
import EditStudyPageStyles from '../../Studies/EditStudyPage/EditStudyPage.styles';
import EditAnnotationsPageStyles from './EditAnnotationsPage.styles';
import { useAuth0 } from '@auth0/auth0-react';
import { AnnotationNote } from '../../../neurostore-typescript-sdk';
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
import { useDeleteAnnotation, useGetAnnotationById, useUpdateAnnotationById } from 'hooks';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';

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
    const { isAuthenticated, user } = useAuth0();
    const [confirmationIsOpen, setConfirmationIsOpen] = useState(false);

    const params: {
        annotationId: string;
        studysetId: string;
    } = useParams();

    const { data: annotation } = useGetAnnotationById(params?.annotationId);
    const { mutate: updateAnnotationName, isLoading: updateAnnotationNameIsLoading } =
        useUpdateAnnotationById(params.annotationId);
    const { mutate: updateAnnotationDescription, isLoading: updateAnnotationDescriptionIsLoading } =
        useUpdateAnnotationById(params.annotationId);
    const { mutate: updateAnnotation } = useUpdateAnnotationById(params.annotationId);
    const { mutate: deleteAnnotation, isLoading: deleteAnnotationIsLoading } =
        useDeleteAnnotation();

    const thisUserOwnsThisAnnotation = (annotation?.user || null) === (user?.sub || undefined);

    const handleUpdateName = (updatedName: string, label: string) => {
        if (params?.annotationId) {
            updateAnnotationName({
                argAnnotationId: params.annotationId,
                annotation: {
                    name: updatedName,
                },
            });
        }
    };

    const handleUpdateDescription = (updatedDescription: string, label: string) => {
        if (params?.annotationId) {
            updateAnnotationDescription({
                argAnnotationId: params.annotationId,
                annotation: {
                    description: updatedDescription,
                },
            });
        }
    };

    const handleCloseConfirmationDialog = async (confirm: boolean | undefined) => {
        setConfirmationIsOpen(false);

        if (confirm && annotation && annotation?.id) {
            deleteAnnotation(annotation.id, {
                onSuccess: () => {
                    // delete annotation hook already opens a snackbar on success and failure
                    history.push(`/studysets/${params.studysetId}`);
                },
            });
        }
    };

    const handleSaveAnnotation = (
        annotationNotes: AnnotationNote[],
        noteKeyTypes: { [key: string]: EPropertyType }
    ) => {
        updateAnnotation({
            argAnnotationId: params.annotationId,
            annotation: {
                notes: annotationNotes.map((annotationNote) => ({
                    note: annotationNote.note,
                    analysis: annotationNote.analysis,
                    study: annotationNote.study,
                })),
                note_keys: noteKeyTypes,
            },
        });
    };

    return (
        <>
            <Box sx={{ marginBottom: '1rem' }}>
                <BackButton text="Return to studyset" path={`/studysets/${params.studysetId}`} />
            </Box>

            <Box sx={{ marginBottom: '1rem' }}>
                <TextEdit
                    editIconIsVisible={thisUserOwnsThisAnnotation}
                    isLoading={updateAnnotationNameIsLoading}
                    onSave={handleUpdateName}
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
                    editIconIsVisible={thisUserOwnsThisAnnotation}
                    isLoading={updateAnnotationDescriptionIsLoading}
                    label="description"
                    sx={{ fontSize: '1.25rem' }}
                    onSave={handleUpdateDescription}
                    textToEdit={annotation?.description || ''}
                >
                    <Typography variant="h6">
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

            <LoadingButton
                loaderColor="primary"
                isLoading={deleteAnnotationIsLoading}
                disabled={!isAuthenticated || !thisUserOwnsThisAnnotation}
                sx={[EditStudyPageStyles.button, { marginTop: '1rem' }]}
                color="error"
                onClick={() => setConfirmationIsOpen(true)}
                variant="contained"
                text="Delete this annotation"
            ></LoadingButton>
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

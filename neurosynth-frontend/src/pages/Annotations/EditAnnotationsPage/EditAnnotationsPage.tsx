import { Typography, Button, Box, Paper } from '@mui/material';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useParams } from 'react-router';
import API, { AnnotationsApiResponse } from '../../../utils/api';
import {
    ConfirmationDialog,
    EPropertyType,
    IMetadataRowModel,
    INeurosynthCell,
    NeurosynthLoader,
    NeurosynthSpreadsheetWrapper,
    TextEdit,
} from '../../../components';
import { getType } from '../../../components/EditMetadata/EditMetadata';
import EditStudyPageStyles from '../../Studies/EditStudyPage/EditStudyPage.styles';
import EditAnnotationsPageStyles from './EditAnnotationsPage.styles';
import AddMetadataRow from '../../../components/EditMetadata/EditMetadataRow/AddMetadataRow';
import { CellChange } from 'handsontable/common';
import { AnnotationNote } from '../../../gen/api';
import { useAuth0 } from '@auth0/auth0-react';
import { GlobalContext, SnackbarType } from '../../../contexts/GlobalContext';

export const convertToAnnotationObject = (
    annotation: AnnotationsApiResponse,
    data: { [key: string]: string | boolean | number }[]
): AnnotationNote[] => {
    return (annotation.notes || []).map((annotationNote, index) => {
        return {
            analysis: annotationNote.analysis,
            study: annotationNote.study,
            note: data[index],
        };
    });
};

export const getTypeForColumn = (columnKey: string, notes: AnnotationNote[]): EPropertyType => {
    for (let i = 0; i < notes.length; i++) {
        const currentNote = notes[i].note || null;
        const value = (currentNote as any)[columnKey] as string | boolean | number | null;
        if (value !== null) {
            // typescript complains here that string cannot be used to index type {} so we must cast it
            return getType(value);
        }
    }
    return EPropertyType.STRING;
};

const EditAnnotationsPage: React.FC = (props) => {
    const [confirmationIsOpen, setConfirmationIsOpen] = useState(false);
    const { isAuthenticated, getAccessTokenSilently } = useAuth0();
    const { handleToken, showSnackbar } = useContext(GlobalContext);
    const [annotation, setAnnotation] = useState<AnnotationsApiResponse>();
    const history = useHistory();
    const [rowHeaders, setRowHeaders] = useState<string[]>([]);
    const [columnHeaders, setColumnHeaders] = useState<INeurosynthCell[]>();

    const [spreadsheetData, setSpreadsheetData] =
        useState<{ [key: string]: string | boolean | number }[]>();
    const [saveChangesDisabled, setSaveChangesDisabled] = useState(true);

    const params: {
        annotationId: string;
        datasetId: string;
    } = useParams();

    useEffect(() => {
        if (params.annotationId) {
            const getAnnotation = () => {
                // TODO: annotationsIdGet is broken. Setting the export prop to true/false sets it to export mode
                // We must keep it set to undefined as the backend reads it as falsey
                API.Services.AnnotationsService.annotationsIdGet(params.annotationId)
                    .then((res) => {
                        // temp solution to handle the annotationExport case
                        const resData = res.data as AnnotationsApiResponse;

                        if (!resData?.notes || resData.notes.length === 0) {
                            setSpreadsheetData([]);
                            return;
                        }

                        const notes = resData.notes;
                        setAnnotation(resData);

                        /**
                         * Extract the keys from the first note obj. We can do this
                         * because we assume that all notes in the db have the same keys
                         *
                         * if notes.length is not 0, then the note object should not be undefined
                         */
                        const noteKeys: string[] = Object.keys(notes[0].note as object);

                        const rowHeaders = notes.map((note) => note.analysis || '');
                        setRowHeaders(rowHeaders);

                        const columnLabelValues = noteKeys.map((noteKey) => ({
                            value: noteKey,
                            type: getTypeForColumn(noteKey, notes),
                        }));
                        setColumnHeaders(columnLabelValues);

                        const spreadsheetValues: {
                            [key: string]: string | number | boolean;
                        }[] = notes.map(
                            (noteObj) =>
                                noteObj.note as { [key: string]: string | number | boolean }
                        );
                        setSpreadsheetData(spreadsheetValues);
                    })
                    .catch((err) => {
                        console.error(err);
                        showSnackbar(
                            'there was an error retrieving the annotation',
                            SnackbarType.ERROR
                        );
                    });
            };
            getAnnotation();
        }
    }, [params.annotationId, showSnackbar]);

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

    const handleAddColumn = (model: IMetadataRowModel) => {
        const columnKeyExists = !!columnHeaders?.find((col) => col.value === model.metadataKey);
        if (columnKeyExists) return false;

        setColumnHeaders((prevState) => {
            if (!prevState) return prevState;
            const newState = [
                ...prevState,
                { value: model.metadataKey, type: getType(model.metadataValue) },
            ];
            return newState;
        });

        setSpreadsheetData((prevState) => {
            if (!prevState) return prevState;
            const newState = [...prevState];

            for (let i = 0; i < newState.length; i++) {
                const updatedRow = { ...newState[i] };
                updatedRow[model.metadataKey] = model.metadataValue;
                newState[i] = updatedRow;
            }
            return newState;
        });

        setSaveChangesDisabled(false);

        return true;
    };

    const handleOnCancel = (event: React.MouseEvent) => {
        history.push(`/datasets/${params.datasetId}`);
    };

    const handleColumnDelete = useCallback((colIndexDeleted: number, colDeleted: string) => {
        setColumnHeaders((prevState) => {
            if (!prevState) return prevState;
            const newState = [...prevState];
            newState.splice(colIndexDeleted, 1);
            return newState;
        });
        setSpreadsheetData((prevState) => {
            if (!prevState) return prevState;
            const newState = [...prevState];
            for (let i = 0; i < newState.length; i++) {
                const newRow = { ...newState[i] };
                delete newRow[colDeleted];
                newState[i] = newRow;
            }
            return newState;
        });
        setSaveChangesDisabled(false);
    }, []);

    const handleCellUpdates = useCallback((changes: CellChange[]) => {
        if (!changes || changes.length === 0) return;

        setSpreadsheetData((prevState) => {
            if (!prevState) return prevState;
            const newState = [...prevState];
            changes.forEach((change) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const [row, colStringName, oldCellVal, newCellVal] = change;
                const oldRow = newState[row];
                const updatedRow = { ...oldRow };
                updatedRow[colStringName] = newCellVal;
                newState[row] = updatedRow;
            });
            return newState;
        });
        setSaveChangesDisabled(false);
    }, []);

    const handleOnSaveChanges = async (event: React.MouseEvent) => {
        if (annotation && annotation.id && spreadsheetData) {
            const annotationObject = convertToAnnotationObject(annotation, spreadsheetData);
            try {
                const token = await getAccessTokenSilently();
                handleToken(token);
            } catch (exception) {
                showSnackbar('there was an error', SnackbarType.ERROR);
                console.error(exception);
            }
            API.Services.AnnotationsService.annotationsIdPut(annotation.id, {
                notes: annotationObject,
            })
                .then((res) => {
                    showSnackbar('annotation updated', SnackbarType.SUCCESS);
                    setSaveChangesDisabled(true);
                })
                .catch((err) => {
                    console.error(err);
                    showSnackbar('there was an error saving the annotation', SnackbarType.ERROR);
                });
        }
    };

    const handleCloseDialog = async (confirm: boolean | undefined) => {
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

            <Box
                component={Paper}
                sx={{
                    padding: '10px',
                    ...(saveChangesDisabled ? {} : EditAnnotationsPageStyles.unsavedChanges),
                }}
            >
                {isAuthenticated && (
                    <Box sx={EditAnnotationsPageStyles.addColumnContainer}>
                        <AddMetadataRow
                            allowNoneOption={false}
                            keyPlaceholderText="Column Key"
                            valuePlaceholderText="Default Value"
                            errorMessage="All column keys must be unique"
                            onAddMetadataRow={handleAddColumn}
                        />
                    </Box>
                )}
                <NeurosynthLoader loaded={!!(spreadsheetData && columnHeaders && rowHeaders)}>
                    {spreadsheetData && columnHeaders && rowHeaders && (
                        <NeurosynthSpreadsheetWrapper
                            onCellUpdates={handleCellUpdates}
                            onColumnDelete={handleColumnDelete}
                            data={spreadsheetData}
                            rowHeaderValues={rowHeaders}
                            columnHeaderValues={columnHeaders}
                        />
                    )}
                </NeurosynthLoader>
                {isAuthenticated && (
                    <Box
                        component="div"
                        sx={{ width: '100%', display: 'flex', justifyContent: 'end' }}
                    >
                        <Button
                            color="primary"
                            onClick={handleOnSaveChanges}
                            variant="contained"
                            disabled={saveChangesDisabled}
                            sx={{
                                ...EditStudyPageStyles.button,
                                marginTop: '0.5rem',
                            }}
                        >
                            Save Annotation Changes
                        </Button>
                    </Box>
                )}
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
                onCloseDialog={handleCloseDialog}
            />
        </>
    );
};

export default EditAnnotationsPage;

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
    ISpreadsheetDataRow,
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
    data: ISpreadsheetDataRow[]
): AnnotationNote[] => {
    const pureData = data
        .filter((row) => !row._isStudyTitle)
        .map((row) => {
            const { _studyTitle, _isStudyTitle, ...everythingElse } = row;
            return everythingElse;
        });
    return (annotation.notes || []).map((annotationNote, index) => {
        return {
            analysis: annotationNote.analysis,
            study: annotationNote.study,
            note: pureData[index],
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
    const history = useHistory();
    const { isAuthenticated, getAccessTokenSilently } = useAuth0();
    const { handleToken, showSnackbar } = useContext(GlobalContext);

    const [confirmationIsOpen, setConfirmationIsOpen] = useState(false);
    const [annotation, setAnnotation] = useState<AnnotationsApiResponse>();
    const [rowHeaders, setRowHeaders] = useState<string[]>();
    const [columnHeaders, setColumnHeaders] = useState<INeurosynthCell[]>();
    const [spreadsheetData, setSpreadsheetData] = useState<ISpreadsheetDataRow[]>();
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
                        setAnnotation(resData);

                        const notes = (resData.notes || []).sort((a, b) => {
                            const firstStudyId = a.study as string;
                            const secondStudyId = b.study as string;
                            return firstStudyId.localeCompare(secondStudyId);
                        });

                        if (!notes || notes.length === 0) {
                            setSpreadsheetData([]);
                            setColumnHeaders([]);
                            setRowHeaders([]);
                            return;
                        }

                        /**
                         * Extract the keys from the first note obj. We can do this
                         * because we assume that all notes in the db have the same keys
                         *
                         * if notes.length is not 0, then the note object should not be undefined
                         */
                        const noteKeys: string[] = Object.keys(notes[0].note as object);

                        const columnLabelValues = noteKeys.map((noteKey) => ({
                            value: noteKey,
                            type: getTypeForColumn(noteKey, notes),
                        }));
                        setColumnHeaders(columnLabelValues);

                        const rowHeaders: string[] = [];
                        const spreadsheetData: ISpreadsheetDataRow[] = [];
                        let index = 0;
                        let lastStudyId: string | undefined = undefined;

                        while (index < notes.length) {
                            const currNote = notes[index];
                            const currStudyId = currNote.study as string;
                            const currStudyName = currNote.study_name as string;

                            if (currStudyId !== lastStudyId) {
                                // we hit a new study, do not increase index as we need to push a title row

                                if (noteKeys.length > 0) {
                                    // columns exist, so we want to set the study title as the first column (for handsontable to show value as
                                    // as merged group of cells)
                                    rowHeaders.push('');
                                    spreadsheetData.push({
                                        [noteKeys[0]]: currStudyName,
                                        _studyTitle: currStudyName,
                                        _isStudyTitle: true,
                                    });
                                } else {
                                    // no columns exist, we set the study title in the row header
                                    rowHeaders.push(currStudyName);
                                    spreadsheetData.push({
                                        _studyTitle: currStudyName,
                                        _isStudyTitle: true,
                                    });
                                }
                                lastStudyId = currStudyId;
                            } else {
                                // we do not need to push a new title row

                                if (noteKeys.length > 0) {
                                    // columns exist, just add the regular row
                                    spreadsheetData.push({
                                        ...(currNote.note as {
                                            [key: string]: string | boolean | number;
                                        }),
                                        _studyTitle: currStudyName,
                                        _isStudyTitle: false,
                                    });
                                } else {
                                    // no columns exist, there is no data to add to the row
                                    spreadsheetData.push({
                                        _studyTitle: currStudyName,
                                        _isStudyTitle: false,
                                    });
                                }
                                rowHeaders.push(currNote.analysis_name || '');
                                index++;
                            }
                        }

                        setRowHeaders(rowHeaders);
                        setSpreadsheetData(spreadsheetData);
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

    useEffect(() => {
        if (spreadsheetData) {
            setRowHeaders((prevState) => {
                if (!prevState) return prevState;
                const hasColumns = Object.keys(spreadsheetData[0]).length - 2 > 0;
                const updatedState = [...prevState];
                let requiresUpdate = false;
                for (let i = 0; i < updatedState.length; i++) {
                    const rowHeaderIsStudyTitle = spreadsheetData[i]._isStudyTitle;
                    const rowHeaderStudyTitle = spreadsheetData[i]._studyTitle;
                    const tempVal = hasColumns ? '' : rowHeaderStudyTitle;

                    if (rowHeaderIsStudyTitle && tempVal !== updatedState[i]) {
                        requiresUpdate = true;
                        updatedState[i] = tempVal;
                    }
                }
                return requiresUpdate ? updatedState : prevState;
            });
        }
    }, [spreadsheetData]);

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

    const handleColumnAdd = (model: IMetadataRowModel): boolean => {
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
                if (updatedRow._isStudyTitle) {
                    /**
                     * for rows that are study titles, we want to set the first column as the title,
                     * and the other columns as null for HandsOnTable to merge the cells
                     */

                    // first time adding a column, subtract 2 for the two keys we added manually
                    const noColumns = Object.keys(updatedRow).length - 2 === 0;
                    updatedRow[model.metadataKey] = noColumns
                        ? updatedRow._studyTitle
                        : (null as any);
                } else {
                    // for rows that are not study titles, we just set the data as usual
                    updatedRow[model.metadataKey] = model.metadataValue;
                }
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
            const newColumnHeadersState = [...prevState];
            newColumnHeadersState.splice(colIndexDeleted, 1);

            setSpreadsheetData((prevState) => {
                if (!prevState) return prevState;
                const newSpreadsheetDataState = [...prevState];
                for (let i = 0; i < newSpreadsheetDataState.length; i++) {
                    const newSpreadsheetRow = { ...newSpreadsheetDataState[i] };
                    const spreadsheetRowHasColumns = newColumnHeadersState.length > 0;
                    delete newSpreadsheetRow[colDeleted];

                    if (
                        newSpreadsheetRow._isStudyTitle &&
                        colIndexDeleted === 0 &&
                        spreadsheetRowHasColumns
                    ) {
                        // As all study titles are set as the 0th column key, we need to handle the case where the 0th column is removed.
                        // We don't care about other cases.

                        /**
                         * Handle case where there are still columns.
                         * Note that this could either be updated or not, as setColumnHeaders() is asynchronous.
                         * We therefore need to handle both cases.
                         *
                         * (1) If the first column header value is the same as colDeleted, that means that it hasn't been updated yet and we need to get the next one.
                         * (2) If the first column header value is different than colDeleted, that means it has been updated and we can use it.
                         */
                        const newFirstColumnKey = newColumnHeadersState[0].value;
                        newSpreadsheetRow[newFirstColumnKey] = newSpreadsheetRow._studyTitle;
                    }
                    newSpreadsheetDataState[i] = newSpreadsheetRow;
                }
                return newSpreadsheetDataState;
            });
            return newColumnHeadersState;
        });
        setSaveChangesDisabled(false);
    }, []);

    const handleCellUpdates = useCallback((changes: CellChange[]) => {
        console.log('update');

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

    const hasRowHeaders = rowHeaders && rowHeaders.length > 0;
    const showAnnotationEditControls = isAuthenticated && hasRowHeaders;

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
                {showAnnotationEditControls && (
                    <Box sx={EditAnnotationsPageStyles.addColumnContainer}>
                        <AddMetadataRow
                            allowNoneOption={false}
                            keyPlaceholderText="Column Key"
                            valuePlaceholderText="Default Value"
                            errorMessage="All column keys must be unique"
                            onAddMetadataRow={handleColumnAdd}
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
                {showAnnotationEditControls && (
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

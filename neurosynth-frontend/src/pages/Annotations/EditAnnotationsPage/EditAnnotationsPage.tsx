import { Typography, Button, Box } from '@mui/material';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useParams } from 'react-router';
import API, { AnnotationsApiResponse } from '../../../utils/api';
import { IMetadataRowModel, NeurosynthSpreadsheet, TextEdit } from '../../../components';
import { getType } from '../../../components/EditMetadata/EditMetadata';
import EditStudyPageStyles from '../../Studies/EditStudyPage/EditStudyPage.styles';
import EditAnnotationsPageStyles from './EditAnnotationsPage.styles';
import AddMetadataRow from '../../../components/EditMetadata/EditMetadataRow/AddMetadataRow';
import { INeurosynthCell } from '../../../components/NeurosynthSpreadsheet/NeurosynthSpreadsheet';
import { CellChange } from 'handsontable/common';
import { AnnotationNotes } from '../../../gen/api';
import { useAuth0 } from '@auth0/auth0-react';
import { GlobalContext, SnackbarType } from '../../../contexts/GlobalContext';

export const convertToAnnotationObject = (
    annotation: AnnotationsApiResponse,
    columnHeaders: INeurosynthCell[],
    data: (string | number | boolean | null)[][]
): AnnotationNotes[] => {
    return (annotation.notes || []).map((annotation, index) => {
        const dataRow = data[index];
        const newNote: { [key: string]: string | number | boolean | null } = {};
        columnHeaders.forEach((columnHeader, columnIndex) => {
            newNote[columnHeader.value] = dataRow[columnIndex];
        });

        return {
            analysis: annotation.analysis,
            study: annotation.study,
            note: newNote,
        };
    });
};

const EditAnnotationsPage: React.FC = (props) => {
    const { getAccessTokenSilently } = useAuth0();
    const { handleToken, showSnackbar } = useContext(GlobalContext);
    const [annotation, setAnnotation] = useState<AnnotationsApiResponse>();
    const history = useHistory();
    const [rowHeaders, setRowHeaders] = useState<string[]>([]);
    const [columnHeaders, setColumnHeaders] = useState<INeurosynthCell[]>([]);
    const [data, setData] = useState<(string | number | boolean | null)[][]>([]);
    const [saveChangesDisabled, setSaveChangesDisabled] = useState(true);

    const params: {
        annotationId: string;
        datasetId: string;
    } = useParams();

    useEffect(() => {
        if (params.annotationId) {
            const getAnnotation = () => {
                API.Services.AnnotationsService.annotationsIdGet(params.annotationId)
                    .then((res) => {
                        console.log(res);
                        return;

                        // if (!res?.data) return;

                        // setAnnotation(res.data);
                        // const notes = res.data.notes;

                        // if (notes === undefined || notes.length === 0) {
                        //     // setData([]);
                        // } else {
                        //     /**
                        //      * Extract the keys from the first note obj. We can do this
                        //      * because we assume that all notes in the db have the same keys
                        //      *
                        //      * if notes.length is not 0, then the note object should not be undefined
                        //      */
                        //     const noteKeys: string[] = Object.keys(notes[0].note as object);
                        //     const firstNote = notes[0].note as { [key: string]: any };

                        //     const rowHeaders = notes.map((note) => note.analysis || '');
                        //     setRowHeaders(rowHeaders);

                        //     const columnLabelValues = noteKeys.map((noteKey) => ({
                        //         value: noteKey,
                        //         type: getType(firstNote[noteKey]),
                        //     }));
                        //     setColumnHeaders(columnLabelValues);

                        //     const spreadsheetValues: string[][] = notes.map((noteObj) => {
                        //         const convertedNotes = noteKeys.map(
                        //             (key) => (noteObj.note as any)[key]
                        //         );
                        //         return convertedNotes;
                        //     });
                        //     setData(spreadsheetValues);
                        // }
                    })
                    .catch((err) => {
                        console.error(err);
                    });
            };
            getAnnotation();
        }
    }, [params.annotationId]);

    const updateAnnotationDetails = (property: 'name' | 'description', updatedText: string) => {
        // API.Services.AnnotationsService.annotationsIdPut(params.annotationId, )
        alert('Editing annotation values still requires implementation');
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

        setData((prevState) => {
            if (!prevState) return prevState;
            const newState = [...prevState];

            for (let i = 0; i < newState.length; i++) {
                const updatedRow = [...newState[i], model.metadataValue];
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

    const handleColumnDelete = useCallback((colDeleted: number) => {
        setColumnHeaders((prevState) => {
            if (!prevState) return prevState;
            const newState = [...prevState];
            newState.splice(colDeleted, 1);
            return newState;
        });
        setData((prevState) => {
            if (!prevState) return prevState;
            const newState = [...prevState];
            for (let i = 0; i < newState.length; i++) {
                const oldRow = newState[i];
                const newRow = [...oldRow];
                newRow.splice(colDeleted, 1);
                newState[i] = newRow;
            }
            return newState;
        });
        setSaveChangesDisabled(false);
    }, []);

    const handleCellUpdates = (changes: CellChange[]) => {
        if (!changes || changes.length === 0) return;

        setData((prevState) => {
            const newState = [...prevState];
            changes.forEach((change) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const [row, col, oldCellVal, newCellVal] = change;
                const oldRow = newState[row];
                const updatedRow = [...oldRow];
                updatedRow[col as number] = newCellVal;
                newState[row] = updatedRow;
            });
            return newState;
        });
        setSaveChangesDisabled(false);
    };

    const handleOnSaveChanges = async (event: React.MouseEvent) => {
        if (annotation) {
            const annotationObject = convertToAnnotationObject(annotation, columnHeaders, data);

            try {
                const token = await getAccessTokenSilently();
                handleToken(token);
            } catch (exception) {
                showSnackbar('there was an error', SnackbarType.ERROR);
                console.error(exception);
            }

            // API.Services.AnnotationsService.annotationsIdPut(annotation.id, ).then(() => {

            // }).catch(() => {

            // }).finally(() => {

            // })
            setSaveChangesDisabled(false);
            showSnackbar('annotation updated', SnackbarType.SUCCESS);
        }
    };

    return (
        <>
            <Box sx={EditAnnotationsPageStyles.stickyButtonContainer}>
                <Button
                    color="primary"
                    onClick={handleOnSaveChanges}
                    variant="contained"
                    disabled={saveChangesDisabled}
                    sx={{ ...EditStudyPageStyles.button, marginRight: '1rem' }}
                >
                    Save Changes
                </Button>
                <Button
                    color="error"
                    onClick={handleOnCancel}
                    sx={EditStudyPageStyles.button}
                    variant="outlined"
                >
                    Return to Dataset View
                </Button>
            </Box>

            <TextEdit
                onSave={(updatedText) => updateAnnotationDetails('name', updatedText)}
                textToEdit={annotation?.name || ''}
                sx={{ fontSize: '2rem' }}
            >
                <Typography variant="h4">
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

            <Box sx={EditAnnotationsPageStyles.addColumnContainer}>
                <AddMetadataRow
                    keyPlaceholderText="Column Key"
                    valuePlaceholderText="Default Value"
                    errorMessage="All column keys must be unique"
                    onAddMetadataRow={handleAddColumn}
                />
            </Box>

            <NeurosynthSpreadsheet
                onCellUpdates={handleCellUpdates}
                onColumnDelete={handleColumnDelete}
                data={data}
                rowHeaderValues={rowHeaders}
                columnHeaderValues={columnHeaders}
            />
        </>
    );
};

export default EditAnnotationsPage;

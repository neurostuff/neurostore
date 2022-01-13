import { Typography, Button, Box } from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useParams } from 'react-router';
import API, { AnnotationsApiResponse } from '../../../utils/api';
import {
    EPropertyType,
    IMetadataRowModel,
    NeurosynthSpreadsheet,
    TextEdit,
} from '../../../components';
import { getType } from '../../../components/EditMetadata/EditMetadata';
import EditStudyPageStyles from '../../Studies/EditStudyPage/EditStudyPage.styles';
import EditAnnotationsPageStyles from './EditAnnotationsPage.styles';
import AddMetadataRow from '../../../components/EditMetadata/EditMetadataRow/AddMetadataRow';
import { INeurosynthCell } from '../../../components/NeurosynthSpreadsheet/NeurosynthSpreadsheet';

const EditAnnotationsPage: React.FC = (props) => {
    const [annotation, setAnnotation] = useState<AnnotationsApiResponse>();
    const history = useHistory();
    const [rowHeaders, setRowHeaders] = useState<string[]>([]);
    const [columnHeaders, setColumnHeaders] = useState<INeurosynthCell[]>([]);
    const [data, setData] = useState<(string | number)[][]>([]);

    const params: {
        annotationId: string;
        datasetId: string;
    } = useParams();

    useEffect(() => {
        if (params.annotationId) {
            const getAnnotation = () => {
                API.Services.AnnotationsService.annotationsIdGet(params.annotationId)
                    .then((res) => {
                        if (!res?.data) return;

                        setAnnotation(res.data);
                        const notes = res.data.notes;

                        if (notes === undefined || notes.length === 0) {
                            // setData([]);
                        } else {
                            /**
                             * Extract the keys from the first note obj. We can do this
                             * because we assume that all notes in the db have the same keys
                             *
                             * if notes.length is not 0, then the note object should not be undefined
                             */
                            const noteKeys: string[] = Object.keys(notes[0].note as object);
                            const firstNote = notes[0].note as { [key: string]: any };

                            const rowHeaders = notes.map((note) => note.analysis || '');
                            setRowHeaders(rowHeaders);

                            const columnLabelValues = noteKeys.map((noteKey) => ({
                                value: noteKey,
                                type: getType(firstNote[noteKey]),
                            }));
                            setColumnHeaders(columnLabelValues);

                            const spreadsheetValues: string[][] = notes.map((noteObj) => {
                                const convertedNotes = noteKeys.map(
                                    (key) => (noteObj.note as any)[key]
                                );
                                return convertedNotes;
                            });
                            setData(spreadsheetValues);
                        }
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
                const updatedRow = [...newState[i], `${model.metadataValue}`];
                newState[i] = updatedRow;
            }

            return newState;
        });

        return true;
    };

    const handleOnCancel = (event: React.MouseEvent) => {
        history.push(`/datasets/${params.datasetId}`);
    };

    const handleColumnDelete = useCallback((colDeleted: number) => {
        console.log(colDeleted);

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
    }, []);

    const handleOnSaveChanges = (event: React.MouseEvent) => {};

    return (
        <>
            <Box sx={EditAnnotationsPageStyles.stickyButtonContainer}>
                <Button
                    color="primary"
                    onClick={handleOnSaveChanges}
                    variant="contained"
                    disabled={true}
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
                onColumnDelete={handleColumnDelete}
                data={data}
                rowHeaderValues={rowHeaders}
                columnHeaderValues={columnHeaders}
            />
        </>
    );
};

export default EditAnnotationsPage;

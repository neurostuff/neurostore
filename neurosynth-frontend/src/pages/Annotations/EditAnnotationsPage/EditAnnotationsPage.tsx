import { Typography, Button, Box, TextField, Paper } from '@mui/material';
import React, { MouseEvent, useEffect, useState } from 'react';
import Spreadsheet, { CellBase, Matrix } from 'react-spreadsheet';
import { useParams } from 'react-router';
import API, { AnnotationsApiResponse } from '../../../utils/api';
import { EPropertyType, IMetadataRowModel, NeurosynthSpreadsheet } from '../../../components';
import { getType } from '../../../components/EditMetadata/EditMetadata';
import ToggleType from '../../../components/EditMetadata/EditMetadataRow/ToggleType/ToggleType';
import EditMetadataRowStyles from '../../../components/EditMetadata/EditMetadataRow/EditMetadataRow.styles';
import EditStudyPageStyles from '../../Studies/EditStudyPage/EditStudyPage.styles';
import EditAnnotationsPageStyles from './EditAnnotationsPage.styles';
import AddMetadataRow, {
    getStartValFromType,
} from '../../../components/EditMetadata/EditMetadataRow/AddMetadataRow';

const EditAnnotationsPage: React.FC = (props) => {
    const [annotation, setAnnotation] = useState<AnnotationsApiResponse>();
    const [data, setData] = useState<Matrix<CellBase<any>>>();
    const [rowLabels, setRowLabels] = useState<string[]>();
    const [columnLabels, setColumnLabels] = useState<{ value: string; type: EPropertyType }[]>();

    const params: { annotationId: string } = useParams();

    useEffect(() => {
        if (params.annotationId) {
            const getAnnotation = () => {
                API.Services.AnnotationsService.annotationsIdGet(params.annotationId)
                    .then((res) => {
                        if (!res?.data) return;

                        setAnnotation(res.data);
                        const notes = res.data.notes;

                        if (notes === undefined || notes.length === 0) {
                            setData([]);
                        } else {
                            /**
                             * Extract the keys from the first note. We can do this
                             * because we assume that all notes in the db have the same keys
                             *
                             * if notes.length is not 0, then the note object should not be undefined
                             */
                            const noteKeys: string[] = Object.keys(notes[0].note as object);
                            const firstNote = notes[0].note as { [key: string]: any };

                            const rowLabels = notes.map((note) => note.analysis || '');
                            setRowLabels(rowLabels);

                            const columnLabelValues = noteKeys.map((noteKey) => ({
                                value: noteKey,
                                type: getType(firstNote[noteKey]),
                            }));
                            setColumnLabels(columnLabelValues);

                            const spreadsheetValues = notes.map((noteObj) => {
                                const convertedNotes = noteKeys.map((key) => ({
                                    value: (noteObj.note as any)[key],
                                    className: getType((noteObj.note as any)[key]),
                                }));
                                return convertedNotes;
                            });

                            const spreadsheetData: Matrix<CellBase<any>> = spreadsheetValues;
                            setData(spreadsheetData);
                        }
                    })
                    .catch((err) => {
                        console.error(err);
                    });
            };
            getAnnotation();
        }
    }, [params.annotationId]);

    const handleAddColumn = (model: IMetadataRowModel) => {
        const columnKeyExists = !!columnLabels?.find((col) => col.value === model.metadataKey);
        if (columnKeyExists) return false;

        setColumnLabels((prevState) => {
            if (!prevState) return prevState;
            const newState = [...prevState];
            newState.push({
                value: model.metadataKey,
                type: getType(model.metadataValue),
            });
            return newState;
        });

        setData((prevState) => {
            if (!prevState) return prevState;
            const newState = [...prevState];

            for (let i = 0; i < newState.length; i++) {
                const updatedRow = [
                    ...newState[i],
                    {
                        value: model.metadataValue,
                        className: getType(model.metadataValue),
                    },
                ];
                newState[i] = updatedRow;
            }
            return newState;
        });

        return true;
    };

    const handleOnCancel = (event: React.MouseEvent) => {};

    const handleOnSaveChanges = (event: React.MouseEvent) => {};

    return (
        <>
            <Box sx={EditAnnotationsPageStyles.stickyButtonContainer}>
                <Button
                    color="primary"
                    onClick={handleOnSaveChanges}
                    variant="contained"
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
            <Typography sx={{ marginBottom: '1rem' }} variant="h4">
                Annotation
            </Typography>

            <Box sx={EditAnnotationsPageStyles.addColumnContainer}>
                <AddMetadataRow
                    keyPlaceholderText="Column Key"
                    valuePlaceholderText="Default Value"
                    onAddMetadataRow={handleAddColumn}
                />
            </Box>

            <NeurosynthSpreadsheet
                columnLabelValues={columnLabels || []}
                rowLabelValues={rowLabels || []}
                data={data}
            />
        </>
    );
};

export default EditAnnotationsPage;

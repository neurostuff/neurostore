import {
    Box,
    Button,
    ListItem,
    ListItemText,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import { EPropertyType } from 'components/EditMetadata';
import NeurosynthAutocomplete from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import { useGetAnnotationById } from 'hooks';
import { Fragment, useEffect, useState } from 'react';
import BaseDialog, { IDialog } from '../BaseDialog';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { AnnotationNoteValue } from 'components/EditAnnotations/helpers/utils';
import {
    useProjectExtractionAnnotationId,
    useProjectSelectionMetadata,
    useUpdateSelectionFilter,
} from 'pages/Projects/ProjectPage/ProjectStore';
import SelectionDialogStyles from './SelectionDialog.styles';

export const getFilteredAnnotationNotes = (
    annotationNotes: NoteCollectionReturn[],
    selectionKey: string | undefined
): NoteCollectionReturn[] => {
    if (!annotationNotes || !selectionKey) return [];
    return annotationNotes.filter((x) => {
        const annotationNote = x.note as { [key: string]: AnnotationNoteValue };
        return annotationNote[selectionKey] === true; // for now, we only care about boolean filters. Later, the filter process will get more complicated
    });
};

// we can assume that the input is already sorted
const annotationNotesToTableFormat = (
    notes: NoteCollectionReturn[],
    selectedNotes: NoteCollectionReturn[]
) => {
    let currStudy = '';
    const tableFormat: {
        studyName: string;
        studyId: string;
        analyses: { analysisName: string; analysisId: string; isSelected: boolean }[];
    }[] = [];

    const selectedNotesMap = new Map();
    selectedNotes.forEach((note) => selectedNotesMap.set(note.analysis, note));

    [...notes]
        .sort((a, b) => {
            const firstStudyId = a.study as string;
            const secondStudyId = b.study as string;
            return firstStudyId.localeCompare(secondStudyId);
        })
        .forEach((note) => {
            if (note.study === currStudy) {
                tableFormat[tableFormat.length - 1].analyses.push({
                    analysisId: note.analysis as string,
                    analysisName: note.analysis_name as string,
                    isSelected: selectedNotesMap.has(note.analysis),
                });
            } else {
                currStudy = note.study as string;
                tableFormat.push({
                    studyName: note.study_name as string,
                    studyId: note.study as string,
                    analyses: [
                        {
                            analysisId: note.analysis as string,
                            analysisName: note.analysis_name as string,
                            isSelected: selectedNotesMap.has(note.analysis),
                        },
                    ],
                });
            }
        });

    return tableFormat;
};

const SelectionDialog: React.FC<IDialog> = (props) => {
    const updateSelection = useUpdateSelectionFilter();
    const selectionMetadata = useProjectSelectionMetadata();
    const annotationId = useProjectExtractionAnnotationId();
    const { data: annotation } = useGetAnnotationById(annotationId);

    const [annotationsSelected, setAnnotationsSelected] = useState<NoteCollectionReturn[]>([]);
    const [selectedValue, setSelectedValue] = useState<
        | {
              selectionKey: string | undefined;
              type: EPropertyType;
          }
        | undefined
    >(undefined);

    const handleSelectFilter = () => {
        if (selectedValue?.selectionKey) {
            updateSelection({
                ...selectedValue,
            });

            handleCloseDialog();
        }
    };

    useEffect(() => {
        setSelectedValue({
            selectionKey: selectionMetadata.filter.selectionKey,
            type: selectionMetadata.filter.type,
        });
    }, [selectionMetadata]);

    useEffect(() => {
        setAnnotationsSelected((prev) => {
            if (!selectedValue?.selectionKey) return [];
            const filteredAnnotations = getFilteredAnnotationNotes(
                (annotation?.notes || []) as NoteCollectionReturn[],
                selectedValue.selectionKey
            );

            return filteredAnnotations;
        });
    }, [selectedValue, annotation]);

    const options = Object.entries(annotation?.note_keys || {})
        .map(([key, value]) => ({
            selectionKey: key,
            type: value as EPropertyType,
        }))
        .filter((x) => x.type === EPropertyType.BOOLEAN);

    const analysesDisplayed = selectedValue?.selectionKey
        ? annotationNotesToTableFormat(
              (annotation?.notes || []) as NoteCollectionReturn[],
              annotationsSelected
          )
        : [];

    const handleCloseDialog = () => {
        props.onCloseDialog();
        setSelectedValue({
            selectionKey: selectionMetadata.filter.selectionKey,
            type: selectionMetadata.filter.type,
        });
    };

    return (
        <BaseDialog
            isOpen={props.isOpen}
            maxWidth="md"
            fullWidth
            onCloseDialog={handleCloseDialog}
            dialogTitle={`${annotationsSelected.length} / ${
                annotation?.notes?.length || 0
            } analyses selected`}
        >
            <Box>
                <Typography gutterBottom>
                    Select the <b>annotation inclusion column</b> that you would like to use to
                    select the analyses for your meta-analysis.
                </Typography>
                <Typography sx={{ color: 'warning.dark', marginBottom: '1rem' }}>
                    At the moment, only boolean columns will be supported. We will be adding support
                    for the other types in the near future.
                </Typography>

                <NeurosynthAutocomplete
                    label="Inclusion Column"
                    shouldDisable={false}
                    isOptionEqualToValue={(option, value) =>
                        option?.selectionKey === value?.selectionKey
                    }
                    value={selectedValue}
                    size="medium"
                    required={false}
                    renderOption={(params, option) => (
                        <ListItem {...params} key={option.selectionKey}>
                            <ListItemText
                                sx={{
                                    color: NeurosynthTableStyles[option.type || EPropertyType.NONE],
                                }}
                                primary={option?.selectionKey || ''}
                            />
                        </ListItem>
                    )}
                    getOptionLabel={(option) => option?.selectionKey || ''}
                    onChange={(_event, newVal, _reason) => setSelectedValue(newVal || undefined)}
                    options={options}
                />

                <Box sx={{ maxHeight: '40vh', overflow: 'auto', margin: '1rem 0' }}>
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Study</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Analyses</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {analysesDisplayed.map((analysisDisplayed) => (
                                    <Fragment key={analysisDisplayed.studyId}>
                                        <TableRow>
                                            <TableCell
                                                sx={[
                                                    SelectionDialogStyles.tableCell,
                                                    { maxWidth: '300px' },
                                                ]}
                                                rowSpan={analysisDisplayed.analyses.length}
                                            >
                                                {analysisDisplayed.studyName}
                                            </TableCell>
                                            <TableCell
                                                sx={[
                                                    SelectionDialogStyles.tableCell,
                                                    analysisDisplayed.analyses[0].isSelected
                                                        ? SelectionDialogStyles.selected
                                                        : SelectionDialogStyles['not-selected'],
                                                ]}
                                            >
                                                {analysisDisplayed.analyses[0].analysisName}
                                            </TableCell>
                                        </TableRow>
                                        {analysisDisplayed.analyses
                                            .slice(1, analysisDisplayed.analyses.length)
                                            .map((analysis) => (
                                                <TableRow key={analysis.analysisId}>
                                                    <TableCell
                                                        sx={[
                                                            SelectionDialogStyles.tableCell,
                                                            analysis.isSelected
                                                                ? SelectionDialogStyles.selected
                                                                : SelectionDialogStyles[
                                                                      'not-selected'
                                                                  ],
                                                        ]}
                                                    >
                                                        {analysis.analysisName}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                    </Fragment>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    {annotationsSelected.length === 0 && (
                        <Typography sx={{ color: 'warning.dark', marginTop: '1rem' }}>
                            No analyses selected
                        </Typography>
                    )}
                </Box>

                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                    }}
                >
                    <Button
                        onClick={handleSelectFilter}
                        disabled={selectedValue === undefined}
                        variant="contained"
                    >
                        save
                    </Button>
                </Box>
            </Box>
        </BaseDialog>
    );
};

export default SelectionDialog;

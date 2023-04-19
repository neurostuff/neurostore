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

// we can assume that the input is already sorted
const annotationNotesToTableFormat = (notes: NoteCollectionReturn[]) => {
    let currStudy = '';
    const tableFormat: {
        studyName: string;
        studyId: string;
        analyses: { analysisName: string; analysisId: string }[];
    }[] = [];

    notes.forEach((note) => {
        if (note.study === currStudy) {
            tableFormat[tableFormat.length - 1].analyses.push({
                analysisId: note.analysis as string,
                analysisName: note.analysis_name as string,
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
                    },
                ],
            });
        }
    });

    return tableFormat;
};

const SelectionDialog: React.FC<IDialog> = (props) => {
    const annotationId = useProjectExtractionAnnotationId();
    const updateSelection = useUpdateSelectionFilter();
    const selectionMetadata = useProjectSelectionMetadata();
    const { data: annotation } = useGetAnnotationById(annotationId);

    const [analysesSelected, setAnalysesSelected] = useState<NoteCollectionReturn[]>([]);
    const [selectedValue, setSelectedValue] = useState<
        | {
              selectionKey: string | undefined;
              type: EPropertyType;
          }
        | undefined
    >(selectionMetadata?.filter?.selectionKey ? { ...selectionMetadata.filter } : undefined);

    const handleSelectFilter = () => {
        // if (projectId && project?.provenance && selectedValue) {
        //     mutate(
        //         {
        //             projectId: projectId,
        //             project: {
        //                 provenance: {
        //                     ...project.provenance,
        //                     filtrationMetadata: {
        //                         filter: {
        //                             filtrationKey: selectedValue.selectionKey,
        //                             type: selectedValue.type as EPropertyType,
        //                         },
        //                     },
        //                 },
        //             },
        //         },
        //         {
        //             onSuccess: () => {
        //                 props.onCloseDialog();
        //             },
        //         }
        //     );
        // }
    };

    useEffect(() => {
        setAnalysesSelected((prev) => {
            if (!selectedValue?.selectionKey) return [];
            const filteredAnnotations = ((annotation?.notes || []) as NoteCollectionReturn[])
                .filter((x) => {
                    const annotationNote = x.note as { [key: string]: AnnotationNoteValue };
                    return annotationNote[selectedValue.selectionKey as string] === true; // for now, we only care about boolean values
                })
                .sort((a, b) => {
                    const firstStudyId = a.study as string;
                    const secondStudyId = b.study as string;
                    return firstStudyId.localeCompare(secondStudyId);
                });
            return filteredAnnotations;
        });
    }, [selectedValue, annotation]);

    const options = Object.entries(annotation?.note_keys || {})
        .map(([key, value]) => ({
            selectionKey: key,
            type: value as EPropertyType,
        }))
        .filter((x) => x.type === EPropertyType.BOOLEAN);

    const analysesDisplayed = annotationNotesToTableFormat(analysesSelected);

    return (
        <BaseDialog
            isOpen={props.isOpen}
            maxWidth="md"
            fullWidth
            onCloseDialog={props.onCloseDialog}
            dialogTitle={`${analysesSelected.length} / ${
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
                                    <TableCell sx={{ fontWeight: 'bold' }}>
                                        Selected Analyses
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {analysesDisplayed.map((analysisDisplayed) => (
                                    <Fragment key={analysisDisplayed.studyId}>
                                        <TableRow>
                                            <TableCell
                                                sx={{ maxWidth: '100px' }}
                                                rowSpan={analysisDisplayed.analyses.length}
                                            >
                                                {analysisDisplayed.studyName}
                                            </TableCell>
                                            <TableCell>
                                                {analysisDisplayed.analyses[0].analysisName}
                                            </TableCell>
                                        </TableRow>
                                        {analysisDisplayed.analyses
                                            .slice(1, analysisDisplayed.analyses.length)
                                            .map((analysis) => (
                                                <TableRow key={analysis.analysisId}>
                                                    <TableCell>{analysis.analysisName}</TableCell>
                                                </TableRow>
                                            ))}
                                    </Fragment>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    {analysesSelected.length === 0 && (
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
                        select filter
                    </Button>
                </Box>
            </Box>
        </BaseDialog>
    );
};

export default SelectionDialog;

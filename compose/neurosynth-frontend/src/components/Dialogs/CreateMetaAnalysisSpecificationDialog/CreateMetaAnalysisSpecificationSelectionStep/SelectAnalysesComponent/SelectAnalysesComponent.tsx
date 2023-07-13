import {
    Box,
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
import { Fragment, useEffect, useState } from 'react';
import SelectAnalysesComponentStyles from './SelectAnalysesComponent.styles';
import NeurosynthAutocomplete from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import NeurosynthTableStyles from 'components/Tables/NeurosynthTable/NeurosynthTable.styles';
import { EPropertyType } from 'components/EditMetadata';
import { useGetAnnotationById } from 'hooks';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { AnnotationNoteValue } from 'components/EditAnnotations/helpers/utils';

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
const annotationNotesToTableFormatHelper = (
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

const SelectAnalysesComponent: React.FC<{
    annotationdId: string;
    selectedValue:
        | {
              selectionKey: string | undefined;
              type: EPropertyType;
          }
        | undefined;
    onSelectValue: (
        value: { selectionKey: string | undefined; type: EPropertyType } | undefined
    ) => void;
}> = (props) => {
    const { annotationdId, selectedValue, onSelectValue } = props;
    const [selectionOccurred, setSelectionOccurred] = useState(false);
    const { data: annotation } = useGetAnnotationById(annotationdId);
    const [annotationsSelected, setAnnotationsSelected] = useState<NoteCollectionReturn[]>([]);

    useEffect(() => {
        if (selectedValue?.selectionKey) {
            setSelectionOccurred(true);
        } else if (!selectionOccurred && 'included' in (annotation?.note_keys || {})) {
            onSelectValue({ selectionKey: 'included', type: EPropertyType.BOOLEAN });
            setSelectionOccurred(true);
        }
    }, [selectedValue?.selectionKey, annotation, onSelectValue, selectionOccurred]);

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

    const studiesList = selectedValue?.selectionKey
        ? annotationNotesToTableFormatHelper(
              (annotation?.notes || []) as NoteCollectionReturn[],
              annotationsSelected
          )
        : [];

    return (
        <Box>
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
                onChange={(_event, newVal, _reason) => onSelectValue(newVal || undefined)}
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
                            {studiesList.map((studyAnalyses) => (
                                <Fragment key={studyAnalyses.studyId}>
                                    <TableRow>
                                        <TableCell
                                            sx={[
                                                SelectAnalysesComponentStyles.tableCell,
                                                { maxWidth: '300px' },
                                            ]}
                                            rowSpan={studyAnalyses.analyses.length}
                                        >
                                            {studyAnalyses.studyName}
                                        </TableCell>
                                        <TableCell
                                            sx={[
                                                SelectAnalysesComponentStyles.tableCell,
                                                studyAnalyses.analyses[0].isSelected
                                                    ? SelectAnalysesComponentStyles.selected
                                                    : SelectAnalysesComponentStyles['not-selected'],
                                            ]}
                                        >
                                            {studyAnalyses.analyses[0].analysisName}
                                        </TableCell>
                                    </TableRow>
                                    {studyAnalyses.analyses
                                        .slice(1, studyAnalyses.analyses.length)
                                        .map((analysis) => (
                                            <TableRow key={analysis.analysisId}>
                                                <TableCell
                                                    sx={[
                                                        SelectAnalysesComponentStyles.tableCell,
                                                        analysis.isSelected
                                                            ? SelectAnalysesComponentStyles.selected
                                                            : SelectAnalysesComponentStyles[
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
        </Box>
    );
};

export default SelectAnalysesComponent;

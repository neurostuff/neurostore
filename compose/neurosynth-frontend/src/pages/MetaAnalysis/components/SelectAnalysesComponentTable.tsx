import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { Box } from '@mui/system';
import EditStudyComponentsStyles from 'pages/Study/components/EditStudyComponents.styles';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { Fragment, useMemo } from 'react';
import { IAnalysesSelection } from 'pages/MetaAnalysis/components/CreateMetaAnalysisSpecificationDialogBase.types';
import { annotationNotesToTableFormatHelper, getFilteredAnnotationNotes } from './SelectAnalysesComponent.helpers';
import SelectAnalysesComponentStyles from './SelectAnalysesComponent.styles';

const SelectAnalysesComponentTable: React.FC<{
    allNotes: NoteCollectionReturn[] | undefined;
    selectedValue: IAnalysesSelection;
}> = (props) => {
    const { selectedValue, allNotes } = props;

    const selectedNotes = useMemo(() => {
        if (!selectedValue?.selectionKey) return [];
        return getFilteredAnnotationNotes((allNotes || []) as NoteCollectionReturn[], selectedValue);
    }, [allNotes, selectedValue]);

    const studiesList = useMemo(() => {
        return selectedValue?.selectionKey ? annotationNotesToTableFormatHelper(allNotes || [], selectedNotes) : [];
    }, [allNotes, selectedValue, selectedNotes]);

    return (
        <Box>
            <NeurosynthAccordion
                TitleElement={
                    <Box>
                        <Typography sx={{ display: 'block' }}>Inclusion Summary</Typography>
                        <Typography sx={{ display: 'block' }} variant="caption">
                            Green rows represent analyses included based on the given selection. Red rows represent
                            analyses excluded from selection.
                        </Typography>
                    </Box>
                }
                expandIconColor="black"
                accordionSummarySx={EditStudyComponentsStyles.accordionSummary}
                sx={{ marginBottom: '1rem !important' }}
            >
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
                                                sx={[SelectAnalysesComponentStyles.tableCell, { maxWidth: '300px' }]}
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
                                                                : SelectAnalysesComponentStyles['not-selected'],
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
                    {studiesList.length === 0 && (
                        <Typography sx={{ color: 'warning.dark', marginTop: '1rem' }}>No analyses selected</Typography>
                    )}
                </Box>
            </NeurosynthAccordion>
        </Box>
    );
};

export default SelectAnalysesComponentTable;

import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { Box } from '@mui/system';
import DebouncedTextField from 'components/DebouncedTextField';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import { useMeasure } from 'hooks';
import { NoteCollectionReturn } from 'neurostore-typescript-sdk';
import { Fragment, useMemo, useState } from 'react';
import { IAnalysesSelection } from 'pages/MetaAnalysis/components/CreateMetaAnalysisSpecificationDialogBase.types';
import EditStudyComponentsStyles from 'pages/StudyCBMA/components/EditStudyComponents.styles';
import {
    annotationNotesToTableFormatHelper,
    filterStudyAnalysesTable,
    getFilteredAnnotationNotes,
} from './SelectAnalysesComponent.helpers';
import SelectAnalysesComponentStyles from './SelectAnalysesComponent.styles';

const HeaderFilterCell = ({
    label,
    filterValue,
    onFilterChange,
    filterAriaLabel,
}: {
    label: string;
    filterValue: string | undefined;
    onFilterChange: (value: string | undefined) => void;
    filterAriaLabel: string;
}) => {
    return (
        <TableCell sx={[SelectAnalysesComponentStyles.tableCell, SelectAnalysesComponentStyles.headerCell]}>
            <Box sx={{ fontWeight: 'bold' }}>{label}</Box>
            <Box sx={{ marginTop: '4px' }}>
                <DebouncedTextField
                    size="small"
                    placeholder="filter"
                    sx={SelectAnalysesComponentStyles.filterInput}
                    value={filterValue}
                    onChange={onFilterChange}
                    inputProps={{ 'aria-label': filterAriaLabel }}
                />
            </Box>
        </TableCell>
    );
};

const SelectAnalysesComponentTable = (props: {
    allNotes: NoteCollectionReturn[] | undefined;
    selectedValue: IAnalysesSelection;
}) => {
    const { selectedValue, allNotes } = props;
    const [studyFilter, setStudyFilter] = useState<string | undefined>(undefined);
    const [analysisFilter, setAnalysisFilter] = useState<string | undefined>(undefined);
    const { ref: tableHeadRef, height: tableHeadHeight } = useMeasure<HTMLTableSectionElement>();

    const selectedNotes = useMemo(() => {
        if (!selectedValue?.selectionKey) return [];
        return getFilteredAnnotationNotes((allNotes || []) as NoteCollectionReturn[], selectedValue);
    }, [allNotes, selectedValue]);

    const studiesList = useMemo(() => {
        return selectedValue?.selectionKey ? annotationNotesToTableFormatHelper(allNotes || [], selectedNotes) : [];
    }, [allNotes, selectedValue, selectedNotes]);

    const filteredStudiesList = useMemo(() => {
        return filterStudyAnalysesTable(studiesList, studyFilter, analysisFilter);
    }, [studiesList, studyFilter, analysisFilter]);

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
                <Box sx={{ margin: '0' }}>
                    <TableContainer sx={SelectAnalysesComponentStyles.tableContainer}>
                        <Table stickyHeader>
                            <TableHead ref={tableHeadRef}>
                                <TableRow>
                                    <HeaderFilterCell
                                        label="Study"
                                        filterValue={studyFilter}
                                        onFilterChange={setStudyFilter}
                                        filterAriaLabel="Filter studies"
                                    />
                                    <HeaderFilterCell
                                        label="Analyses"
                                        filterValue={analysisFilter}
                                        onFilterChange={setAnalysisFilter}
                                        filterAriaLabel="Filter analyses"
                                    />
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredStudiesList.map((studyAnalyses) => (
                                    <Fragment key={studyAnalyses.studyId}>
                                        <TableRow>
                                            <TableCell
                                                sx={[
                                                    SelectAnalysesComponentStyles.tableCell,
                                                    SelectAnalysesComponentStyles.studyCell,
                                                ]}
                                                rowSpan={studyAnalyses.analyses.length}
                                            >
                                                <Box
                                                    sx={[
                                                        SelectAnalysesComponentStyles.stickyStudyName,
                                                        { top: tableHeadHeight + 10 }, // +10 to account for padding and border
                                                    ]}
                                                >
                                                    {studyAnalyses.studyName}
                                                </Box>
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
                    {studiesList.length > 0 && filteredStudiesList.length === 0 && (
                        <Typography sx={{ color: 'warning.dark', marginTop: '1rem' }}>
                            No matching studies or analyses
                        </Typography>
                    )}
                </Box>
            </NeurosynthAccordion>
        </Box>
    );
};

export default SelectAnalysesComponentTable;

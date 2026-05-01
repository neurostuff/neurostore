import { Box, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import NewAnnotationColumnDialog, {
    type NewAnnotationColumnPayload,
} from 'pages/StudyIBMA/components/NewAnnotationColumnDialog';
import { flexRender, type Table as TanstackTable } from '@tanstack/react-table';
import React, { Fragment, useCallback, useState } from 'react';
import type { AnalysisBoardRow } from '../hooks/useEditStudyAnalysisBoardState.types';
import { EditStudyAnalysisMapsExpandedRow } from './EditStudyAnalysisMapsExpandedRow';
import { EditStudyAnalysisTableRow } from './EditStudyAnalysisTableRow';
import { STUDY_ANALYSIS_TABLE_MAX_HEIGHT, studyAnalysisStickyHeaderSx } from './editStudyAnalysisBoard.constants';
import { Add } from '@mui/icons-material';
import { useAddOrUpdateAnalysis, useStudyAnalyses, useStudyId } from 'stores/study/StudyStore';
import {
    useAnnotationNoteKeys,
    useCreateAnnotationColumn,
    useCreateAnnotationNote,
} from 'stores/annotation/AnnotationStore.actions';

export type EditStudyAnalysisTableProps = {
    table: TanstackTable<AnalysisBoardRow>;
    tableMinWidth: number;
};

export const EditStudyAnalysisTable: React.FC<EditStudyAnalysisTableProps> = ({ table, tableMinWidth }) => {
    const addOrUpdateAnalysis = useAddOrUpdateAnalysis();
    const createAnnotationNote = useCreateAnnotationNote();
    const createAnnotationColumn = useCreateAnnotationColumn();
    const noteKeys = useAnnotationNoteKeys();
    const studyId = useStudyId();
    const analyses = useStudyAnalyses();
    const [newAnnotationColumnDialogOpen, setNewAnnotationColumnDialogOpen] = useState(false);

    const handleCreateNewAnalysis = useCallback(() => {
        if (!studyId) return;
        const createdAnalysis = addOrUpdateAnalysis({
            name: '',
            description: '',
            isNew: true,
            conditions: [],
            order: analyses.length + 1,
            images: [],
        });
        if (!createdAnalysis.id) return;
        createAnnotationNote(createdAnalysis.id, studyId, '');
    }, [studyId, addOrUpdateAnalysis, analyses.length, createAnnotationNote]);

    const handleAddAnnotationColumn = useCallback(
        (payload: NewAnnotationColumnPayload) => {
            createAnnotationColumn({
                key: payload.key,
                type: payload.type,
                default: payload.default,
            });
        },
        [createAnnotationColumn]
    );

    return (
        <>
            <Paper
                data-testid="edit-study-analysis-table"
                sx={{
                    flex: 1,
                    minWidth: 0,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    overflow: 'hidden',
                    backgroundColor: 'grey.100',
                }}
            >
                <TableContainer
                    sx={{
                        maxHeight: `${STUDY_ANALYSIS_TABLE_MAX_HEIGHT}`,
                        overflow: 'auto',
                        bgcolor: 'background.paper',
                    }}
                    className="sleek-scrollbar"
                >
                    <Table
                        stickyHeader
                        size="small"
                        sx={{
                            minWidth: tableMinWidth,
                            borderCollapse: 'separate',
                            borderSpacing: 0,
                            tableLayout: 'fixed',
                        }}
                    >
                        <TableHead>
                            <TableRow>
                                <TableCell
                                    colSpan={table.getAllColumns().length}
                                    sx={{ py: 1, ...studyAnalysisStickyHeaderSx }}
                                >
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Button
                                            size="small"
                                            sx={{ fontSize: '10px' }}
                                            variant="contained"
                                            disableElevation
                                            onClick={handleCreateNewAnalysis}
                                        >
                                            <Add sx={{ fontSize: '16px' }} />
                                            Analysis
                                        </Button>

                                        <Button
                                            onClick={() => setNewAnnotationColumnDialogOpen(true)}
                                            size="small"
                                            sx={{ fontSize: '10px' }}
                                            variant="contained"
                                            disableElevation
                                            data-testid="new-annotation-column-open"
                                        >
                                            <Add sx={{ fontSize: '16px' }} />
                                            New Annotation Column
                                        </Button>
                                    </Box>
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableHead>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => {
                                        const isAnalysis = header.column.id === 'analysis';
                                        return (
                                            <TableCell
                                                key={header.id}
                                                sx={{
                                                    py: 1,
                                                    ...(isAnalysis
                                                        ? { ...studyAnalysisStickyHeaderSx }
                                                        : {
                                                              bgcolor: 'background.paper',
                                                              borderBottom: 1,
                                                              borderLeft: 1,
                                                              borderColor: 'divider',
                                                              minWidth: 112,
                                                              width: 120,
                                                          }),
                                                }}
                                            >
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(header.column.columnDef.header, header.getContext())}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableHead>
                        <TableBody>
                            {table.getRowModel().rows.map((row) => (
                                <Fragment key={row.id}>
                                    <EditStudyAnalysisTableRow row={row} table={table} />
                                    {row.getIsExpanded() ? (
                                        <EditStudyAnalysisMapsExpandedRow row={row} table={table} />
                                    ) : null}
                                </Fragment>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
            <NewAnnotationColumnDialog
                isOpen={newAnnotationColumnDialogOpen}
                onClose={() => setNewAnnotationColumnDialogOpen(false)}
                existingKeys={(noteKeys ?? []).map((noteKey) => noteKey.key)}
                onAddColumn={handleAddAnnotationColumn}
            />
        </>
    );
};

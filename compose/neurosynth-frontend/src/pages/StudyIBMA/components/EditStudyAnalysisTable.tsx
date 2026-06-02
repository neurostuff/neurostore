import { Add } from '@mui/icons-material';
import { Button, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { flexRender, type Table as TanstackTable } from '@tanstack/react-table';
import type { NoteKeyType } from 'components/HotTables/HotTables.types';
import { EditStudyAnalysisTableRow } from 'pages/StudyIBMA/components/EditStudyAnalysisTableRow';
import NewAnnotationColumnDialog from 'pages/StudyIBMA/components/NewAnnotationColumnDialog';
import analysisQueries from 'hooks/analyses/analysisQueries';
import type { AnalysisBoardRow } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.types';
import 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.tableMeta';
import React, { useState } from 'react';
import { useIsMutating } from 'react-query';
import LoadingButton from 'components/Buttons/LoadingButton';
import Compress from '@mui/icons-material/Compress';
import ExpandIcon from '@mui/icons-material/Expand';
import annotationQueries from 'hooks/annotations/annotationQueries';

export type EditStudyAnalysisTableProps = {
    table: TanstackTable<AnalysisBoardRow>;
    tableMinWidth: number;
    noteKeys?: NoteKeyType[];
};

const toolbarButtonSx = { fontSize: '12px' } as const;

const EditStudyAnalysisTable: React.FC<EditStudyAnalysisTableProps> = ({ table, tableMinWidth, noteKeys = [] }) => {
    const [newAnnotationColumnDialogOpen, setNewAnnotationColumnDialogOpen] = useState(false);
    const tableMeta = table.options.meta;

    const addAnnotationColumn = tableMeta?.addAnnotationColumn;
    const createAnalysis = tableMeta?.createAnalysis;

    const addAnnotationColumnIsMutating = useIsMutating(annotationQueries.mutations.update()) > 0;
    const isCreateAnalysisLoading = useIsMutating(analysisQueries.mutations.create()) > 0;

    return (
        <>
            <Paper
                variant="elevation"
                elevation={2}
                data-testid="edit-study-analysis-table"
                sx={{
                    flex: '2 1 0',
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    borderColor: 'grey.300',
                }}
            >
                <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    flexShrink={0}
                    sx={{ py: 1, px: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.100' }}
                >
                    <LoadingButton
                        size="medium"
                        variant="contained"
                        isLoading={isCreateAnalysisLoading}
                        loaderColor="secondary"
                        disableElevation
                        sx={{ ...toolbarButtonSx, minWidth: '112px', maxHeight: '33px' }}
                        startIcon={<Add />}
                        text="Analysis"
                        onClick={() => void createAnalysis?.()}
                    />
                    <Button
                        size="medium"
                        disableElevation
                        sx={{ ...toolbarButtonSx, minWidth: '112px', maxHeight: '33px', marginLeft: '1rem' }}
                        startIcon={table.getIsAllRowsExpanded() ? <Compress /> : <ExpandIcon />}
                        onClick={() => table.toggleAllRowsExpanded()}
                    >
                        {table.getIsAllRowsExpanded() ? 'Collapse All' : 'Expand All'}
                    </Button>
                    <Button
                        size="medium"
                        variant="contained"
                        disableElevation
                        sx={{ ...toolbarButtonSx, maxHeight: '33px', marginLeft: 'auto' }}
                        data-testid="new-annotation-column-open-button"
                        onClick={() => setNewAnnotationColumnDialogOpen(true)}
                        startIcon={<Add />}
                    >
                        New Annotation Column
                    </Button>
                </Stack>
                <TableContainer
                    className="sleek-scrollbar"
                    sx={{ flex: 1, minHeight: 0, bgcolor: 'background.paper', containerType: 'inline-size' }}
                >
                    <Table
                        stickyHeader
                        size="small"
                        sx={{ minWidth: tableMinWidth, tableLayout: 'fixed', width: '100%' }}
                    >
                        <TableHead>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <TableCell
                                            sx={{
                                                zIndex: header.column.id === 'analysis' ? 10 : undefined,
                                                position: 'sticky',
                                                borderRight: 1,
                                                borderLeft: 1,
                                                borderColor: 'divider',
                                                left: 0,
                                                backgroundColor: 'grey.100',
                                            }}
                                            key={header.id}
                                            width={`${header.column.getSize()}px`}
                                        >
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(header.column.columnDef.header, header.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHead>
                        <TableBody>
                            {table.getRowModel().rows.map((row) => (
                                <EditStudyAnalysisTableRow key={row.id} row={row} table={table} />
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
            <NewAnnotationColumnDialog
                isOpen={newAnnotationColumnDialogOpen}
                isLoading={addAnnotationColumnIsMutating}
                onClose={() => setNewAnnotationColumnDialogOpen(false)}
                existingKeys={(noteKeys ?? []).map((noteKey) => noteKey.key)}
                onAddColumn={addAnnotationColumn}
            />
        </>
    );
};

export default EditStudyAnalysisTable;

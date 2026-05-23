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

export type EditStudyAnalysisTableProps = {
    table: TanstackTable<AnalysisBoardRow>;
    tableMinWidth: number;
    noteKeys?: NoteKeyType[];
};

const toolbarButtonSx = { fontSize: '12px' } as const;

const EditStudyAnalysisTable: React.FC<EditStudyAnalysisTableProps> = ({ table, tableMinWidth, noteKeys = [] }) => {
    const [newAnnotationColumnDialogOpen, setNewAnnotationColumnDialogOpen] = useState(false);
    const tableMeta = table.options.meta;
    const isCreateAnalysisLoading = useIsMutating(analysisQueries.mutations.create()) > 0;

    return (
        <>
            <Paper
                variant="outlined"
                data-testid="edit-study-analysis-table"
                sx={{
                    flex: '2 1 0',
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    bgcolor: 'grey.100',
                }}
            >
                <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    flexShrink={0}
                    sx={{ py: 1, px: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
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
                        onClick={() => void tableMeta?.createAnalysis?.()}
                    />
                    <Button
                        size="medium"
                        variant="contained"
                        disableElevation
                        sx={{ ...toolbarButtonSx, minWidth: '217px', maxHeight: '33px' }}
                        data-testid="new-annotation-column-open-button"
                        onClick={() => setNewAnnotationColumnDialogOpen(true)}
                        startIcon={<Add />}
                    >
                        New Annotation Column
                    </Button>
                </Stack>
                <TableContainer className="sleek-scrollbar" sx={{ flex: 1, minHeight: 0, bgcolor: 'background.paper' }}>
                    <Table
                        stickyHeader
                        size="small"
                        sx={{ minWidth: tableMinWidth, tableLayout: 'fixed', width: '100%' }}
                    >
                        <TableHead>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <TableCell key={header.id} width={`${header.column.getSize()}px`}>
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
                onClose={() => setNewAnnotationColumnDialogOpen(false)}
                existingKeys={(noteKeys ?? []).map((noteKey) => noteKey.key)}
                onAddColumn={(payload) => void tableMeta?.addAnnotationColumn?.(payload)}
            />
        </>
    );
};

export default EditStudyAnalysisTable;

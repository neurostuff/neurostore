import { Box, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import NewAnnotationColumnDialog, {
    type NewAnnotationColumnPayload,
} from 'pages/StudyIBMA/components/NewAnnotationColumnDialog';
import { flexRender, type Table as TanstackTable } from '@tanstack/react-table';
import React, { Fragment, useCallback, useState } from 'react';
import type { AnalysisBoardRow } from '../hooks/useEditStudyAnalysisBoardState.types';
import EditStudyAnalysisMapsExpandedRow from './EditStudyAnalysisMapsExpandedRow';
import { EditStudyAnalysisTableRow } from './EditStudyAnalysisTableRow';
import { useAnnotationNoteKeys, useCreateAnnotationColumn } from 'stores/annotation/AnnotationStore.actions';
import { useParams } from 'react-router-dom';
import { Add } from '@mui/icons-material';

export type EditStudyAnalysisTableProps = {
    table: TanstackTable<AnalysisBoardRow>;
    tableMinWidth: number;
};

export const EditStudyAnalysisTable: React.FC<EditStudyAnalysisTableProps> = ({ table, tableMinWidth }) => {
    const { studyId } = useParams<{ projectId: string; studyId: string }>();
    const createAnnotationColumn = useCreateAnnotationColumn();
    const noteKeys = useAnnotationNoteKeys();
    const [newAnnotationColumnDialogOpen, setNewAnnotationColumnDialogOpen] = useState(false);

    const handleCreateNewAnalysis = useCallback(() => {
        // if (!studyId) return;
        // const createdAnalysis = addOrUpdateAnalysis({
        //     name: '',
        //     description: '',
        //     isNew: true,
        //     conditions: [],
        //     order: analyses.length + 1,
        //     images: [],
        // });
        // if (!createdAnalysis.id) return;
        // createAnnotationNote(createdAnalysis.id, studyId, '');
    }, []);

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
                    flex: '2 1 0',
                    minWidth: 0,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    overflow: 'hidden',
                    backgroundColor: 'grey.100',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexShrink: 0,
                        py: 1,
                        px: 2,
                        borderBottom: 1,
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                    }}
                >
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
                <TableContainer
                    sx={{
                        flex: '1 1 auto',
                        minHeight: 0,
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
                            width: '100%',
                        }}
                    >
                        <TableHead
                            sx={{
                                position: 'sticky',
                                top: 0,
                                backgroundColor: 'background.paper',
                                zIndex: 9,
                            }}
                        >
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => {
                                        return (
                                            <TableCell
                                                key={header.id}
                                                sx={{ py: 1 }}
                                                width={`${header.column.getSize()}px`}
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

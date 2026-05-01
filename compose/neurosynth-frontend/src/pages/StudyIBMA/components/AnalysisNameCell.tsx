import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { Box, IconButton, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import type { CellContext } from '@tanstack/react-table';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import React, { memo, useState } from 'react';
import { useDeleteAnnotationNote } from 'stores/annotation/AnnotationStore.actions';
import type { IStoreAnalysis } from 'stores/study/StudyStore.helpers';
import { useDeleteAnalysis, useStudyAnalysis } from 'stores/study/StudyStore';
import EditStudyAnalysisDialogIBMA from './EditStudyAnalysisDialogIBMA';
import { STUDY_ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX } from './editStudyAnalysisBoard.constants';
import { analysisRowsShallowEqual } from '../hooks/useEditStudyAnalysisBoardState.helpers';
import type { AnalysisBoardRow } from '../hooks/useEditStudyAnalysisBoardState.types';

export const AnalysisNameCell: React.FC<CellContext<AnalysisBoardRow, unknown>> = memo(
    ({ row, table }) => {
        const rowData = row.original;
        const analysis = useStudyAnalysis(rowData.id);
        const deleteAnalysis = useDeleteAnalysis();
        const deleteAnnotationNote = useDeleteAnnotationNote();
        const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
        const [analysisForEdit, setAnalysisForEdit] = useState<IStoreAnalysis | null>(null);
        const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
        const isExpanded = table.getRow(rowData.id)?.getIsExpanded() ?? false;

        if (!analysis?.id) return null;

        const handleDeleteConfirm = (confirm: boolean | undefined) => {
            if (confirm && analysis.id) {
                deleteAnalysis(analysis.id);
                deleteAnnotationNote(analysis.id);
                const assigned = analysis.images ?? [];
                const selectedId = table.options.meta?.selectedImageId ?? null;
                if (
                    selectedId &&
                    assigned.some((m) => typeof m === 'object' && m !== null && 'id' in m && m.id === selectedId)
                ) {
                    table.options.meta?.toggleImageSelection?.(selectedId);
                }
            }
            setDeleteConfirmOpen(false);
        };

        return (
            <>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        py: 0.5,
                        width: '100%',
                        minWidth: 0,
                        minHeight: STUDY_ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX,
                        boxSizing: 'border-box',
                    }}
                >
                    <Tooltip title={isExpanded ? 'Collapse brain maps' : 'Expand brain maps'}>
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                table.getRow(rowData.id)?.toggleExpanded();
                            }}
                            aria-label={isExpanded ? 'Collapse brain maps' : 'Expand brain maps'}
                            sx={{ flexShrink: 0, p: 0.25 }}
                        >
                            <ChevronRightIcon
                                fontSize="small"
                                sx={{
                                    transform: isExpanded ? 'rotate(90deg)' : 'none',
                                    transition: (t) =>
                                        t.transitions.create('transform', {
                                            duration: t.transitions.duration.shorter,
                                        }),
                                }}
                            />
                        </IconButton>
                    </Tooltip>
                    <Box
                        sx={{
                            flex: 1,
                            minWidth: 0,
                            alignSelf: 'stretch',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                        }}
                    >
                        <Typography
                            variant="body2"
                            fontWeight="bold"
                            color={!rowData.name?.trim() ? 'warning.dark' : undefined}
                            noWrap
                            sx={{ lineHeight: 1.43 }}
                        >
                            {rowData.name || 'Untitled'}
                        </Typography>
                        <Typography
                            variant="caption"
                            component="div"
                            lineHeight={1.2}
                            color={!rowData.description?.trim() ? 'warning.dark' : 'text.secondary'}
                            sx={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                minHeight: '2.4em',
                            }}
                        >
                            {rowData.description || 'No description'}
                        </Typography>
                    </Box>
                    <IconButton
                        size="small"
                        onClick={(e) => {
                            e.stopPropagation();
                            setMenuAnchor(e.currentTarget);
                        }}
                        aria-label="Analysis options"
                        sx={{ flexShrink: 0, p: 0.25, alignSelf: 'flex-start', mt: 0.25 }}
                    >
                        <MoreVertIcon fontSize="small" />
                    </IconButton>
                    <Menu
                        open={Boolean(menuAnchor)}
                        anchorEl={menuAnchor}
                        onClose={() => setMenuAnchor(null)}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                    >
                        <MenuItem
                            onClick={() => {
                                setMenuAnchor(null);
                                setAnalysisForEdit(analysis);
                            }}
                        >
                            Edit analysis
                        </MenuItem>
                        <MenuItem
                            onClick={() => {
                                setMenuAnchor(null);
                                setDeleteConfirmOpen(true);
                            }}
                            sx={{ color: 'error.main' }}
                        >
                            Delete analysis
                        </MenuItem>
                    </Menu>
                </Box>
                <EditStudyAnalysisDialogIBMA
                    analysis={analysisForEdit}
                    onClose={() => setAnalysisForEdit(null)}
                />
                <ConfirmationDialog
                    isOpen={deleteConfirmOpen}
                    onCloseDialog={handleDeleteConfirm}
                    dialogTitle="Delete analysis?"
                    dialogMessage="This analysis will be removed. This action cannot be undone."
                    confirmText="Delete"
                    rejectText="Cancel"
                    confirmButtonProps={{ color: 'error' }}
                />
            </>
        );
    },
    (prev, next) =>
        analysisRowsShallowEqual(prev.row.original, next.row.original) &&
        (prev.table.getRow(prev.row.original.id)?.getIsExpanded() ?? false) ===
            (next.table.getRow(next.row.original.id)?.getIsExpanded() ?? false) &&
        prev.table === next.table
);

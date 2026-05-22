import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { Box, IconButton, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import type { CellContext } from '@tanstack/react-table';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import React, { useCallback, useState } from 'react';
import type { AnalysisBoardRow } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.types';
import EditStudyAnalysisDialogIBMA, {
    type EditStudyAnalysisSavePayload,
} from 'pages/StudyIBMA/components/EditStudyAnalysisDialogIBMA';
import { STUDY_ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.consts';

const AnalysisNameCell: React.FC<CellContext<AnalysisBoardRow, unknown>> = ({ row, table }) => {
    const rowData = row.original;
    const onDeleteAnalysis = table.options.meta?.deleteAnalysis;
    const onUpdateAnalysis = table.options.meta?.updateAnalysis;
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
    const [analysisForEdit, setAnalysisForEdit] = useState<AnalysisBoardRow | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const isExpanded = row.getIsExpanded();

    const handleEditAnalysis = useCallback(
        async (payload: EditStudyAnalysisSavePayload) => {
            await onUpdateAnalysis?.(payload);
        },
        [onUpdateAnalysis]
    );

    const handleDeleteConfirm = async (confirm: boolean | undefined) => {
        if (confirm && rowData.id) {
            await onDeleteAnalysis?.(rowData.id);
            const assigned = rowData.images ?? [];
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
                    height: STUDY_ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX,
                    boxSizing: 'border-box',
                }}
            >
                <Tooltip title={isExpanded ? 'Hide brain maps' : 'Show brain maps'}>
                    <IconButton
                        size="small"
                        onClick={(e) => {
                            e.stopPropagation();
                            row.toggleExpanded();
                        }}
                        aria-label={isExpanded ? 'Hide brain maps' : 'See brain maps'}
                        sx={{ p: 0.5, m: 1 }}
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
                    sx={{ p: 0.5, m: 1, alignSelf: 'center' }}
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
                            setAnalysisForEdit(rowData);
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
                onEditAnalysis={handleEditAnalysis}
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
};

export default AnalysisNameCell;

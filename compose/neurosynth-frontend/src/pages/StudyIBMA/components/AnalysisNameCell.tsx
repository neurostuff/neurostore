import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { IconButton, Menu, MenuItem, Stack, Tooltip, Typography } from '@mui/material';
import type { CellContext } from '@tanstack/react-table';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import React, { useCallback, useState } from 'react';
import type { AnalysisBoardRow } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.types';
import EditStudyAnalysisDialogIBMA, {
    type EditStudyAnalysisSavePayload,
} from 'pages/StudyIBMA/components/EditStudyAnalysisDialogIBMA';
import { STUDY_ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.consts';

const analysisCellIconButtonSx = { p: 0.5, m: 1 } as const;

const descriptionClampSx = {
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
} as const;

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
                assigned.some(
                    (image) => typeof image === 'object' && image !== null && 'id' in image && image.id === selectedId
                )
            ) {
                table.options.meta?.toggleImageSelection?.(selectedId);
            }
        }
        setDeleteConfirmOpen(false);
    };

    return (
        <>
            <Stack
                direction="row"
                alignItems="center"
                spacing={0.5}
                sx={{ py: 0.5, width: '100%', minWidth: 0, minHeight: STUDY_ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX }}
            >
                <Tooltip title={isExpanded ? 'Hide images' : 'Show images'}>
                    <IconButton
                        size="small"
                        sx={analysisCellIconButtonSx}
                        onClick={(event) => {
                            event.stopPropagation();
                            row.toggleExpanded();
                        }}
                        aria-label={isExpanded ? 'Hide images' : 'See images'}
                    >
                        <ChevronRightIcon
                            fontSize="small"
                            sx={{
                                transform: isExpanded ? 'rotate(90deg)' : undefined,
                                transition: 'transform 150ms ease',
                            }}
                        />
                    </IconButton>
                </Tooltip>
                <Stack flex={1} minWidth={0} justifyContent="center">
                    <Typography
                        variant="body2"
                        fontWeight="bold"
                        color={!rowData.name?.trim() ? 'warning.dark' : undefined}
                        noWrap
                    >
                        {rowData.name || 'Untitled'}
                    </Typography>
                    <Typography
                        variant="caption"
                        component="div"
                        color={!rowData.description?.trim() ? 'warning.dark' : 'text.secondary'}
                        sx={descriptionClampSx}
                    >
                        {rowData.description || 'No description'}
                    </Typography>
                </Stack>
                <IconButton
                    size="small"
                    sx={analysisCellIconButtonSx}
                    onClick={(event) => {
                        event.stopPropagation();
                        setMenuAnchor(event.currentTarget);
                    }}
                    aria-label="Analysis options"
                >
                    <MoreVertIcon fontSize="small" />
                </IconButton>
                <Menu
                    open={Boolean(menuAnchor)}
                    anchorEl={menuAnchor}
                    onClose={() => setMenuAnchor(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                    MenuListProps={{
                        onMouseDown: (event) => event.preventDefault(),
                    }}
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
            </Stack>
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

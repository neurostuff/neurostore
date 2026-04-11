import { Box, Button, Menu, MenuItem, TextField } from '@mui/material';
import BaseDialog from 'components/Dialogs/BaseDialog';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import React from 'react';
import { BrainMapDetailPanel } from './BrainMapDetailPanel';
import { EditStudyAnalysisTable } from './EditStudyAnalysisTable';
import { UncategorizedMapsColumn } from './UncategorizedMapsColumn';
import { useEditStudyAnalysisBoardState } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState';
import EditStudyToolbar2 from './EditStudyToolbar2';

const EditStudyAnalysisIBMA: React.FC = () => {
    const s = useEditStudyAnalysisBoardState();

    return (
        <Box data-testid="edit-study-analysis-board" sx={{ display: 'flex', gap: 4, width: '100%' }}>
            <UncategorizedMapsColumn
                collapsed={s.uncategorizedCollapsed}
                onCollapsedChange={s.setUncategorizedCollapsed}
                uncategorized={s.uncategorized}
                selectedMapId={s.selectedMapId}
                onToggleMapSelection={s.toggleMapSelection}
                analyses={s.analyses}
                moveMenuAnchor={s.moveAnchorEl}
                onMoveMenuClose={s.handleMoveMenuClose}
                onMoveClick={s.handleMoveClick}
                onMoveToAnalysis={(mapId, targetId) => {
                    s.applyMoveImageToAnalysis(mapId, targetId);
                }}
            />

            <EditStudyAnalysisTable
                table={s.table}
                tableMinWidth={s.tableMinWidth}
                mapsByAnalysisId={s.byAnalysisId}
                analyses={s.analyses}
                selectedMapId={s.selectedMapId}
                analysisEnabled={s.analysisEnabled}
                toggleAnalysisExpanded={s.toggleAnalysisExpanded}
                handleAnalysisMenuOpen={s.handleAnalysisMenuOpen}
                setSelectedMapId={s.toggleMapSelection}
                handleRemoveMapFromAnalysis={s.handleRemoveMapFromAnalysis}
                emptyMaps={s.EMPTY_IMAGES}
            />

            <Menu
                open={Boolean(s.analysisMenuAnchor)}
                anchorEl={s.analysisMenuAnchor?.el ?? null}
                onClose={s.handleAnalysisMenuClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <MenuItem onClick={s.handleEditAnalysis}>Edit analysis</MenuItem>
                <MenuItem onClick={s.handleDeleteAnalysisClick} sx={{ color: 'error.main' }}>
                    Delete analysis
                </MenuItem>
            </Menu>

            {s.selectedBrainMap?.id ? (
                <BrainMapDetailPanel
                    image={s.selectedBrainMap}
                    onClose={() => s.toggleMapSelection(s.selectedBrainMap!.id!)}
                />
            ) : null}

            <BaseDialog
                isOpen={Boolean(s.editModalAnalysis)}
                dialogTitle="Edit analysis"
                onCloseDialog={s.handleCloseEditModal}
                fullWidth
                maxWidth="sm"
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                    <TextField
                        label="Name"
                        size="small"
                        value={s.editName}
                        onChange={(e) => s.setEditName(e.target.value)}
                        fullWidth
                    />
                    <TextField
                        label="Description"
                        size="small"
                        value={s.editDescription}
                        onChange={(e) => s.setEditDescription(e.target.value)}
                        fullWidth
                        multiline
                        rows={3}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                        <Button onClick={s.handleCloseEditModal} variant="text">
                            Cancel
                        </Button>
                        <Button onClick={s.handleSaveEditAnalysis} variant="contained" disableElevation>
                            Save
                        </Button>
                    </Box>
                </Box>
            </BaseDialog>

            <ConfirmationDialog
                isOpen={Boolean(s.deleteConfirmAnalysisId)}
                onCloseDialog={s.handleDeleteConfirm}
                dialogTitle="Delete analysis?"
                dialogMessage="This analysis will be removed. This action cannot be undone."
                confirmText="Delete"
                rejectText="Cancel"
                confirmButtonProps={{ color: 'error' }}
            />

            <EditStudyToolbar2 />
        </Box>
    );
};

export default EditStudyAnalysisIBMA;

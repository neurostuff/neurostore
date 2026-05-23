import { Box, TableCell, TableRow, Typography } from '@mui/material';
import type { Row, Table as TanstackTable } from '@tanstack/react-table';
import SearchableAnalysisMenu from 'pages/StudyIBMA/components/SearchableAnalysisMenu';
import StudyAnalysisImagesList from 'pages/StudyIBMA/components/StudyAnalysisImagesList';
import type { AnalysisBoardRow } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.types';
import React, { useCallback, useState } from 'react';

type MoveMenuAnchor = { el: HTMLElement; imageId: string } | null;

const EditStudyAnalysisImagesExpandedRow: React.FC<{
    row: Row<AnalysisBoardRow>;
    table: TanstackTable<AnalysisBoardRow>;
    selectedImageId: string | null;
}> = ({ row, table, selectedImageId }) => {
    const analysisId = row.original.id;
    const images = row.original.images ?? [];
    const meta = table.options.meta;
    const analyses = meta?.analyses ?? [];
    const onSelectImage = meta?.toggleImageSelection;
    const onUpdateImage = meta?.updateImage;
    const colSpan = table.getVisibleLeafColumns().length;
    const [moveAnchorEl, setMoveAnchorEl] = useState<MoveMenuAnchor>(null);

    const handleMoveClick = useCallback((event: React.MouseEvent<HTMLElement>, imageId: string) => {
        event.stopPropagation();
        setMoveAnchorEl({ el: event.currentTarget, imageId });
    }, []);

    const handleMoveMenuClose = useCallback(() => {
        setMoveAnchorEl(null);
    }, []);

    const handleAssignAnalysisToImage = useCallback(
        (imageId: string, targetAnalysisId: string) => {
            setMoveAnchorEl(null);
            void onUpdateImage?.(imageId, { analysis: targetAnalysisId });
        },
        [onUpdateImage]
    );

    const handleRemoveFromAnalysis = useCallback(
        (imageId: string) => {
            void onUpdateImage?.(imageId, { analysis: undefined });
        },
        [onUpdateImage]
    );

    if (!analysisId) return null;

    return (
        <TableRow>
            <TableCell
                colSpan={colSpan}
                sx={{
                    p: 0,
                    borderBottom: 1,
                    borderColor: 'divider',
                    verticalAlign: 'top',
                }}
            >
                <Box
                    sx={{
                        py: 1.5,
                        px: 6,
                        width: '100%',
                        boxSizing: 'border-box',
                    }}
                >
                    {images.length === 0 ? (
                        <Typography variant="body2" sx={{ color: 'warning.dark' }}>
                            No images assigned to this analysis
                        </Typography>
                    ) : (
                        <StudyAnalysisImagesList
                            images={images}
                            selectedImageId={selectedImageId}
                            onSelectImage={(imageId) => onSelectImage?.(imageId)}
                            onMoveClick={handleMoveClick}
                            onRemoveFromAnalysis={handleRemoveFromAnalysis}
                            stopPropagationOnSelect
                        />
                    )}
                    <SearchableAnalysisMenu
                        open={Boolean(moveAnchorEl)}
                        anchorEl={moveAnchorEl?.el ?? null}
                        onClose={handleMoveMenuClose}
                        analyses={analyses}
                        onSelectAnalysis={(targetAnalysisId) => {
                            if (!moveAnchorEl) return;
                            handleAssignAnalysisToImage(moveAnchorEl.imageId, targetAnalysisId);
                        }}
                    />
                </Box>
            </TableCell>
        </TableRow>
    );
};

export default EditStudyAnalysisImagesExpandedRow;

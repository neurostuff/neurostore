import { Box, TableCell, TableRow, Typography } from '@mui/material';
import type { Row, Table as TanstackTable } from '@tanstack/react-table';
import SearchableAnalysisMenu from 'pages/StudyIBMA/components/SearchableAnalysisMenu';
import ImagesList from 'pages/StudyIBMA/components/ImagesList';
import type { AnalysisBoardRow } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.types';
import React, { useCallback, useState } from 'react';
import { useIsMutating } from 'react-query';
import analysisQueries from 'hooks/analyses/analysisQueries';

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
    const [imageEditType, setImageEditType] = useState<{ action: 'move' | 'remove'; imageId: string }>();

    const updateImageIsMutating = useIsMutating({ mutationKey: analysisQueries.mutations.images.update() }) > 0;
    const removeLoading = updateImageIsMutating && imageEditType?.action === 'remove';
    const updateLoading = updateImageIsMutating && imageEditType?.action === 'move';

    const handleMoveClick = useCallback((event: React.MouseEvent<HTMLElement>, imageId: string) => {
        event.stopPropagation();
        setMoveAnchorEl({ el: event.currentTarget, imageId });
    }, []);

    const handleMoveMenuClose = useCallback(() => {
        setMoveAnchorEl(null);
    }, []);

    const handleAssignAnalysisToImage = useCallback(
        async (imageId: string, targetAnalysisId: string) => {
            setMoveAnchorEl(null);
            setImageEditType({ action: 'move', imageId });
            await onUpdateImage?.(imageId, { analysis: targetAnalysisId });
            setImageEditType(undefined);
        },
        [onUpdateImage]
    );

    const handleRemoveFromAnalysis = useCallback(
        async (imageId: string) => {
            setImageEditType({ action: 'remove', imageId });
            await onUpdateImage?.(imageId, { analysis: undefined });
            setImageEditType(undefined);
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
                        px: 4,
                        boxSizing: 'border-box',
                        position: 'sticky',
                        left: 0,
                        width: '100cqw',
                        maxWidth: '100cqw',
                    }}
                >
                    {images.length === 0 ? (
                        <Typography variant="body2" sx={{ color: 'warning.dark' }}>
                            No images assigned to this analysis
                        </Typography>
                    ) : (
                        <ImagesList
                            images={images}
                            updateImageIsLoading={updateLoading}
                            removeImageIsLoading={removeLoading}
                            loadingImageId={imageEditType?.imageId ?? undefined}
                            selectedImageId={selectedImageId}
                            onSelectImage={(imageId) => onSelectImage?.(imageId)}
                            onMoveClick={handleMoveClick}
                            onRemoveFromAnalysis={handleRemoveFromAnalysis}
                        />
                    )}
                    <SearchableAnalysisMenu
                        open={Boolean(moveAnchorEl)}
                        anchorEl={moveAnchorEl?.el ?? null}
                        onClose={handleMoveMenuClose}
                        analyses={analyses}
                        currentAnalysisId={analysisId}
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

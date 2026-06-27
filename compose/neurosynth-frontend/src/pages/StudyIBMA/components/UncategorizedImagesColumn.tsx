import { Add } from '@mui/icons-material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import { Box, IconButton, Paper, Tooltip, Typography } from '@mui/material';
import { AnalysisReturnNested } from 'hooks/analyses/analysisQueries.types';
import type { ImageReturn } from 'neurostore-typescript-sdk';
import React, { useCallback, useState } from 'react';
import {
    STUDY_UNCATEGORIZED_IMAGES_COLLAPSED_WIDTH,
    STUDY_UNCATEGORIZED_IMAGES_COLUMN_WIDTH,
} from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.consts';
import SearchableAnalysisMenu from 'pages/StudyIBMA/components/SearchableAnalysisMenu';
import ImagesList from 'pages/StudyIBMA/components/ImagesList';
import useIbmaBoardMutations from '../hooks/useIbmaBoardMutations';
import { useIsMutating } from 'react-query';
import analysisQueries from 'hooks/analyses/analysisQueries';

export type UncategorizedImagesColumnProps = {
    collapsed: boolean;
    onCollapsedChange: (collapsed: boolean) => void;
    uncategorized: ImageReturn[];
    selectedImageId: string | null;
    onToggleImageSelection: (imageId: string) => void;
    analyses: AnalysisReturnNested[];
    updateImage?: ReturnType<typeof useIbmaBoardMutations>['updateImage'];
};

const UncategorizedImagesColumn: React.FC<UncategorizedImagesColumnProps> = ({
    collapsed,
    onCollapsedChange,
    uncategorized,
    selectedImageId,
    onToggleImageSelection,
    analyses,
    updateImage,
}) => {
    const [moveAnchorEl, setMoveAnchorEl] = useState<{ el: HTMLElement; imageId: string } | null>(null);
    const [imageEditingId, setImageEditingId] = useState<string>();

    const updateImageIsMutating = useIsMutating({ mutationKey: analysisQueries.mutations.images.update() }) > 0;

    const handleMoveClick = useCallback((event: React.MouseEvent<HTMLElement>, imageId: string) => {
        event.stopPropagation();
        setMoveAnchorEl({ el: event.currentTarget, imageId });
    }, []);

    const handleMoveMenuClose = useCallback(() => {
        setMoveAnchorEl(null);
    }, []);

    const handleAssignAnalysisToImage = useCallback(
        async (imageId: string, analysisId: string) => {
            setMoveAnchorEl(null);
            setImageEditingId(imageId);
            await updateImage?.(imageId, { analysis: analysisId });
            setImageEditingId(undefined);
        },
        [updateImage]
    );

    const updateImageIsLoading = useIsMutating();

    if (collapsed) {
        const collapsedLabel = `Uncategorized images (${uncategorized.length})`;
        return (
            <Paper
                sx={{ width: STUDY_UNCATEGORIZED_IMAGES_COLLAPSED_WIDTH }}
                data-testid="uncategorized-images-collapsed"
            >
                <Tooltip title="Show uncategorized images" placement="right">
                    <IconButton
                        size="small"
                        onClick={() => onCollapsedChange(false)}
                        aria-label={collapsedLabel}
                        sx={{
                            width: '100%',
                            height: '100%',
                            flexDirection: 'column',
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'divider',
                        }}
                    >
                        <Typography
                            variant="caption"
                            sx={{ mb: 1, writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontWeight: 'bold' }}
                        >
                            {collapsedLabel}
                        </Typography>
                        <Add fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Paper>
        );
    }

    return (
        <Paper
            data-testid="uncategorized-images-column"
            sx={{
                width: STUDY_UNCATEGORIZED_IMAGES_COLUMN_WIDTH,
                minWidth: 0,
                borderRight: '1px solid',
                p: 2,
                borderColor: 'divider',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 0.5,
                    minWidth: 0,
                    mb: 2,
                }}
            >
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', minWidth: 0 }} noWrap>
                    Uncategorized images ({uncategorized.length})
                </Typography>
                <Tooltip title="Hide uncategorized images">
                    <IconButton
                        size="small"
                        onClick={() => {
                            handleMoveMenuClose();
                            onCollapsedChange(true);
                        }}
                        aria-label="Hide uncategorized images"
                        sx={{ flexShrink: 0, p: 0.25 }}
                    >
                        <ChevronLeftIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>
            <ImagesList
                images={uncategorized}
                selectedImageId={selectedImageId}
                onSelectImage={onToggleImageSelection}
                onMoveClick={handleMoveClick}
                loadingImageId={imageEditingId}
                updateImageIsLoading={updateImageIsMutating}
            />
            {uncategorized.length === 0 && (
                <Typography variant="body2" sx={{ color: 'warning.dark' }}>
                    No uncategorized images
                </Typography>
            )}
            <SearchableAnalysisMenu
                open={Boolean(moveAnchorEl)}
                anchorEl={moveAnchorEl?.el ?? null}
                onClose={handleMoveMenuClose}
                analyses={analyses}
                onSelectAnalysis={(analysisId) => {
                    if (!moveAnchorEl) return;
                    handleAssignAnalysisToImage(moveAnchorEl.imageId, analysisId);
                }}
            />
        </Paper>
    );
};

export default UncategorizedImagesColumn;

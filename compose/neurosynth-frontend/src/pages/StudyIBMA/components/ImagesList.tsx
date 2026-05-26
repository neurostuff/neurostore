import DriveFileMoveOutlinedIcon from '@mui/icons-material/DriveFileMoveOutlined';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import {
    CircularProgress,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Stack,
    Tooltip,
} from '@mui/material';
import type { ImageReturn } from 'neurostore-typescript-sdk';
import { imageToBrainMapListItem } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.helpers';
import React, { useCallback } from 'react';
import { DefaultMapTypes } from 'stores/study/StudyStore.helpers';

export type ImagesListProps = {
    images: ImageReturn[];
    selectedImageId: string | null;
    updateImageIsLoading: boolean;
    removeImageIsLoading: boolean;
    loadingImageId: string | undefined;
    onSelectImage: (imageId: string) => void;
    onMoveClick: (event: React.MouseEvent<HTMLElement>, imageId: string) => void;
    onRemoveFromAnalysis?: (imageId: string) => void;
};

const ImagesList: React.FC<ImagesListProps> = ({
    images,
    selectedImageId,
    updateImageIsLoading,
    removeImageIsLoading,
    loadingImageId,
    onSelectImage,
    onMoveClick,
    onRemoveFromAnalysis,
}) => {
    const handleActionIconClick = useCallback((event: React.MouseEvent<HTMLElement>, action: () => void) => {
        event.preventDefault();
        event.stopPropagation();
        action();
    }, []);

    return (
        <List dense disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {images
                .filter((image) => image.id)
                .map((image) => {
                    const item = imageToBrainMapListItem(image);
                    const mapTypeLabel = DefaultMapTypes[item.mapType]?.label ?? item.mapType;
                    const isSelected = selectedImageId === image.id;
                    const imageId = image.id!;

                    const removeLoading = removeImageIsLoading && loadingImageId === imageId;
                    const updateLoading = updateImageIsLoading && loadingImageId === imageId;

                    return (
                        <ListItem key={imageId} disablePadding>
                            <ListItemButton
                                dense
                                selected={isSelected}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onSelectImage(imageId);
                                }}
                                sx={{
                                    borderRadius: 1,
                                    bgcolor: 'action.hover',
                                    alignItems: 'flex-start',
                                    gap: 0.5,
                                    '&:hover': { bgcolor: 'action.selected' },
                                    '&.Mui-selected': {
                                        bgcolor: 'action.focus',
                                        '&:hover': { bgcolor: 'action.focus' },
                                    },
                                }}
                            >
                                <ListItemText
                                    primary={item.name}
                                    secondary={mapTypeLabel}
                                    primaryTypographyProps={{
                                        variant: 'caption',
                                        fontWeight: isSelected ? 700 : 400,
                                        color: isSelected ? 'primary.main' : 'text.secondary',
                                        noWrap: true,
                                    }}
                                    secondaryTypographyProps={{
                                        variant: 'caption',
                                        color: 'text.disabled',
                                        noWrap: true,
                                    }}
                                    sx={{ flex: 1, minWidth: 0 }}
                                />
                                <Stack direction="row" spacing={0.25} flexShrink={0} sx={{ alignSelf: 'center' }}>
                                    <Tooltip title="Move to analysis">
                                        {updateLoading ? (
                                            <IconButton size="medium">
                                                <CircularProgress size={24} />
                                            </IconButton>
                                        ) : (
                                            <IconButton
                                                size="medium"
                                                onClick={(event) =>
                                                    handleActionIconClick(event, () => onMoveClick(event, imageId))
                                                }
                                                aria-label="Move image to analysis"
                                            >
                                                <DriveFileMoveOutlinedIcon fontSize="medium" />
                                            </IconButton>
                                        )}
                                    </Tooltip>
                                    {onRemoveFromAnalysis && (
                                        <Tooltip title="Remove from analysis">
                                            {removeLoading ? (
                                                <IconButton size="medium">
                                                    <CircularProgress size={24} />
                                                </IconButton>
                                            ) : (
                                                <IconButton
                                                    size="medium"
                                                    color="error"
                                                    onClick={(event) =>
                                                        handleActionIconClick(event, () =>
                                                            onRemoveFromAnalysis(imageId)
                                                        )
                                                    }
                                                    aria-label="Remove from analysis"
                                                >
                                                    <RemoveCircleOutlineIcon fontSize="medium" />
                                                </IconButton>
                                            )}
                                        </Tooltip>
                                    )}
                                </Stack>
                            </ListItemButton>
                        </ListItem>
                    );
                })}
        </List>
    );
};

export default ImagesList;

import { Add } from '@mui/icons-material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import DriveFileMoveOutlinedIcon from '@mui/icons-material/DriveFileMoveOutlined';
import {
    Box,
    Chip,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Menu,
    MenuItem,
    Paper,
    Tooltip,
    Typography,
} from '@mui/material';
import { AnalysisReturnNested } from 'hooks/analyses/analysisQueries.types';
import type { ImageReturn } from 'neurostore-typescript-sdk';
import { imageToBrainMapListItem } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.helpers';
import React, { useCallback, useState } from 'react';
import { DefaultMapTypes } from 'stores/study/StudyStore.helpers';
import {
    STUDY_UNCATEGORIZED_MAPS_COLLAPSED_WIDTH,
    STUDY_UNCATEGORIZED_MAPS_COLUMN_WIDTH,
} from '../hooks/useEditStudyAnalysisBoardState.consts';

type MoveMenuAnchor = { el: HTMLElement; mapId: string } | null;

export type UncategorizedMapsColumnProps = {
    collapsed: boolean;
    onCollapsedChange: (collapsed: boolean) => void;
    uncategorized: ImageReturn[];
    selectedImageId: string | null;
    onToggleMapSelection: (mapId: string) => void;
    analyses: AnalysisReturnNested[];
    updateImage?: (mapId: string, analysisId: string) => void | Promise<void>;
};

export function UncategorizedMapsColumn({
    collapsed,
    onCollapsedChange,
    uncategorized,
    selectedImageId,
    onToggleMapSelection,
    analyses,
    updateImage,
}: UncategorizedMapsColumnProps) {
    const [moveAnchorEl, setMoveAnchorEl] = useState<MoveMenuAnchor>(null);

    const handleMoveClick = useCallback((event: React.MouseEvent<HTMLElement>, mapId: string) => {
        event.stopPropagation();
        setMoveAnchorEl({ el: event.currentTarget, mapId });
    }, []);

    const handleMoveMenuClose = useCallback(() => {
        setMoveAnchorEl(null);
    }, []);

    const handleAssignAnalysisToImage = useCallback(
        (mapId: string, analysisId: string) => {
            setMoveAnchorEl(null);
            void updateImage?.(mapId, analysisId);
        },
        [updateImage]
    );

    if (collapsed) {
        const collapsedLabel = `Uncategorized maps (${uncategorized.length})`;
        return (
            <Paper sx={{ width: STUDY_UNCATEGORIZED_MAPS_COLLAPSED_WIDTH }} data-testid="uncategorized-maps-collapsed">
                <Tooltip title="Show uncategorized maps" placement="right">
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
            data-testid="uncategorized-maps-column"
            sx={{
                width: STUDY_UNCATEGORIZED_MAPS_COLUMN_WIDTH,
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
                }}
            >
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', minWidth: 0 }} noWrap>
                    Uncategorized maps ({uncategorized.length})
                </Typography>
                <Tooltip title="Hide uncategorized maps">
                    <IconButton
                        size="small"
                        onClick={() => {
                            handleMoveMenuClose();
                            onCollapsedChange(true);
                        }}
                        aria-label="Hide uncategorized maps"
                        sx={{ flexShrink: 0, p: 0.25 }}
                    >
                        <ChevronLeftIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>
            <List>
                {uncategorized.map((image) => {
                    const item = imageToBrainMapListItem(image);
                    if (!image.id) return null;
                    return (
                        <ListItem key={image.id} disablePadding>
                            <ListItemButton
                                selected={selectedImageId === image.id}
                                onClick={() => onToggleMapSelection(image.id!)}
                                sx={{ py: 0.5, minHeight: 36, px: 1 }}
                            >
                                <ListItemText
                                    primary={item.name}
                                    primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                                    sx={{ flex: '1 1 auto', minWidth: 0 }}
                                />
                                <Chip
                                    size="small"
                                    label={DefaultMapTypes[item.mapType]?.label ?? item.mapType}
                                    sx={{ flexShrink: 0, height: 20, fontSize: '0.7rem' }}
                                />
                                <Tooltip title="Move to analysis">
                                    <IconButton
                                        size="small"
                                        onClick={(e) => handleMoveClick(e, image.id!)}
                                        aria-label="Categorize map"
                                        sx={{ flexShrink: 0, p: 0.25 }}
                                    >
                                        <DriveFileMoveOutlinedIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </ListItemButton>
                        </ListItem>
                    );
                })}
            </List>
            <Menu
                open={Boolean(moveAnchorEl)}
                anchorEl={moveAnchorEl?.el ?? null}
                onClose={handleMoveMenuClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                {analyses.map((a) => (
                    <MenuItem
                        key={a.id}
                        onClick={() => {
                            if (!moveAnchorEl) return;
                            handleAssignAnalysisToImage(moveAnchorEl.mapId, a.id!);
                        }}
                    >
                        {a.name || 'Untitled'}
                    </MenuItem>
                ))}
                {analyses.length === 0 && <MenuItem disabled>No analyses yet</MenuItem>}
            </Menu>
        </Paper>
    );
}

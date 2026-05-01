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
import type { ImageReturn } from 'neurostore-typescript-sdk';
import React, { useCallback, useRef, useState } from 'react';
import { useAddOrUpdateAnalysis, useStudyAnalyses } from 'stores/study/StudyStore';
import { DefaultMapTypes, type IStoreAnalysis } from 'stores/study/StudyStore.helpers';
import {
    STUDY_UNCATEGORIZED_MAPS_COLLAPSED_WIDTH,
    STUDY_UNCATEGORIZED_MAPS_COLUMN_WIDTH,
} from './editStudyAnalysisBoard.constants';
import {
    imageToBrainMapListItem,
    moveBrainMapImageToAnalysis,
    syncImageMutationsToStore,
} from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.helpers';

type MoveMenuAnchor = { el: HTMLElement; mapId: string } | null;

export type UncategorizedMapsColumnProps = {
    collapsed: boolean;
    onCollapsedChange: (collapsed: boolean) => void;
    uncategorized: ImageReturn[];
    selectedImageId: string | null;
    onToggleMapSelection: (mapId: string) => void;
    analyses: IStoreAnalysis[];
};

export function UncategorizedMapsColumn({
    collapsed,
    onCollapsedChange,
    uncategorized,
    selectedImageId,
    onToggleMapSelection,
}: UncategorizedMapsColumnProps) {
    const analyses = useStudyAnalyses();
    const addOrUpdateAnalysis = useAddOrUpdateAnalysis();
    const [moveAnchorEl, setMoveAnchorEl] = useState<MoveMenuAnchor>(null);
    const analysesRef = useRef(analyses);
    analysesRef.current = analyses;

    const handleMoveClick = useCallback((event: React.MouseEvent<HTMLElement>, mapId: string) => {
        event.stopPropagation();
        setMoveAnchorEl({ el: event.currentTarget, mapId });
    }, []);

    const handleMoveMenuClose = useCallback(() => {
        setMoveAnchorEl(null);
    }, []);

    const applyMoveImageToAnalysis = useCallback(
        (mapId: string, analysisId: string) => {
            setMoveAnchorEl(null);
            const before = analysesRef.current;
            const next = moveBrainMapImageToAnalysis(before, mapId, analysisId);
            if (!next) return;
            syncImageMutationsToStore(before, next, addOrUpdateAnalysis);
        },
        [addOrUpdateAnalysis]
    );

    if (collapsed) {
        return (
            <Paper sx={{ width: STUDY_UNCATEGORIZED_MAPS_COLLAPSED_WIDTH }} data-testid="uncategorized-maps-collapsed">
                <Tooltip title="Show uncategorized maps" placement="right">
                    <IconButton
                        size="small"
                        onClick={() => onCollapsedChange(false)}
                        aria-label="Show uncategorized maps"
                        sx={{
                            width: '100%',
                            height: '100%',
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'divider',
                        }}
                    >
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
                            applyMoveImageToAnalysis(moveAnchorEl.mapId, a.id!);
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

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
import React from 'react';
import { DefaultMapTypes, type IStoreAnalysis } from 'stores/study/StudyStore.helpers';
import {
    STUDY_UNCATEGORIZED_MAPS_COLLAPSED_WIDTH,
    STUDY_UNCATEGORIZED_MAPS_COLUMN_WIDTH,
} from './editStudyAnalysisBoard.constants';
import { imageToBrainMapListItem } from './editStudyAnalysisBoard.helpers';
import type { UncategorizedImageEntry } from './editStudyAnalysisBoard.types';

export type UncategorizedMapsColumnProps = {
    collapsed: boolean;
    onCollapsedChange: (collapsed: boolean) => void;
    uncategorized: UncategorizedImageEntry[];
    selectedMapId: string | null;
    onToggleMapSelection: (mapId: string) => void;
    analyses: IStoreAnalysis[];
    moveMenuAnchor: { el: HTMLElement; mapId: string } | null;
    onMoveMenuClose: () => void;
    onMoveClick: (e: React.MouseEvent<HTMLElement>, mapId: string) => void;
    onMoveToAnalysis: (mapId: string, targetAnalysisId: string) => void;
};

export function UncategorizedMapsColumn({
    collapsed,
    onCollapsedChange,
    uncategorized,
    selectedMapId,
    onToggleMapSelection,
    analyses,
    moveMenuAnchor,
    onMoveMenuClose,
    onMoveClick,
    onMoveToAnalysis,
}: UncategorizedMapsColumnProps) {
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
                            onMoveMenuClose();
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
                {uncategorized.map(({ image, holderAnalysisId }) => {
                    const item = imageToBrainMapListItem(image);
                    if (!image.id) return null;
                    return (
                        <ListItem key={`${image.id}-${holderAnalysisId}`} disablePadding>
                            <ListItemButton
                                selected={selectedMapId === image.id}
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
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onMoveClick(e, image.id!);
                                        }}
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
                open={Boolean(moveMenuAnchor)}
                anchorEl={moveMenuAnchor?.el ?? null}
                onClose={onMoveMenuClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                {analyses.map((a) => (
                    <MenuItem
                        key={a.id}
                        onClick={() => {
                            if (!moveMenuAnchor) return;
                            onMoveToAnalysis(moveMenuAnchor.mapId, a.id!);
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

import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { Box, Chip, IconButton, ListItemButton, ListItemText, Tooltip, Typography } from '@mui/material';
import type { ImageReturn } from 'neurostore-typescript-sdk';
import React, { memo } from 'react';
import { DefaultMapTypes, type IStoreAnalysis } from 'stores/study/StudyStore.helpers';
import { STUDY_ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX } from './editStudyAnalysisBoard.constants';
import { imageToBrainMapListItem } from './editStudyAnalysisBoard.helpers';
import type { AnalysisBoardRow } from './editStudyAnalysisBoard.types';

export const AnalysisNameCell = memo(
    function AnalysisNameCell({
        row,
        analysis,
        mapsForParent,
        selectedMapId,
        analysisEnabled,
        onToggleExpand,
        onOpenMenu,
        onSelectMap,
        onRemoveMap,
    }: {
        row: AnalysisBoardRow;
        analysis: IStoreAnalysis | undefined;
        mapsForParent: ImageReturn[];
        selectedMapId: string | null;
        analysisEnabled: Record<string, boolean>;
        onToggleExpand: (analysisId: string) => void;
        onOpenMenu: (e: React.MouseEvent<HTMLElement>, analysis: IStoreAnalysis) => void;
        onSelectMap: (mapId: string) => void;
        onRemoveMap: (analysisId: string, map: ImageReturn) => void;
    }) {
        if (row.rowKind === 'detail') {
            const analysisId = row.parentAnalysisId!;
            const maps = mapsForParent;
            const enabled = analysisEnabled[analysisId] !== false;
            return (
                <Box
                    sx={{
                        py: 1,
                        pl: 2,
                        pr: 2,
                        width: '100%',
                        boxSizing: 'border-box',
                    }}
                >
                    {maps.length === 0 ? (
                        <Typography variant="caption" sx={{ color: enabled ? 'warning.dark' : 'text.disabled' }}>
                            No brain maps assigned to this analysis
                        </Typography>
                    ) : (
                        maps.map((map) => {
                            const item = imageToBrainMapListItem(map);
                            return (
                                <Box
                                    key={map.id}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.75,
                                        py: 0.5,
                                    }}
                                >
                                    <ListItemButton
                                        disabled={!enabled}
                                        selected={enabled && selectedMapId === map.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSelectMap(map.id!);
                                        }}
                                        sx={{
                                            flex: 1,
                                            minWidth: 0,
                                            py: 0.5,
                                            minHeight: 36,
                                            px: 1,
                                            borderRadius: 1,
                                        }}
                                    >
                                        <ListItemText
                                            primary={item.name}
                                            primaryTypographyProps={{
                                                variant: 'body2',
                                                noWrap: true,
                                                color: enabled ? undefined : 'text.disabled',
                                            }}
                                            sx={{ flex: '1 1 auto', minWidth: 0 }}
                                        />
                                        <Chip
                                            size="small"
                                            label={DefaultMapTypes[item.mapType]?.label ?? item.mapType}
                                            sx={{
                                                flexShrink: 0,
                                                height: 18,
                                                fontSize: '0.65rem',
                                                ...(!enabled && { opacity: 0.6 }),
                                            }}
                                        />
                                    </ListItemButton>
                                    <IconButton
                                        size="small"
                                        disabled={!enabled}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRemoveMap(analysisId, map);
                                        }}
                                        aria-label="Remove map from analysis"
                                        sx={{ flexShrink: 0, p: 0.25 }}
                                    >
                                        <RemoveCircleOutlineIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            );
                        })
                    )}
                </Box>
            );
        }

        if (!analysis?.id) return null;
        const analysisId = analysis.id;
        const enabled = analysisEnabled[analysisId] !== false;
        const nameMissing = !analysis.name?.trim();
        const descMissing = !analysis.description?.trim();
        const expanded = row.isExpanded ?? false;
        return (
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    py: 0.5,
                    width: '100%',
                    minWidth: 0,
                    minHeight: STUDY_ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX,
                    boxSizing: 'border-box',
                }}
            >
                <Tooltip title={expanded ? 'Collapse brain maps' : 'Expand brain maps'}>
                    <IconButton
                        size="small"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpand(analysisId);
                        }}
                        aria-label={expanded ? 'Collapse brain maps' : 'Expand brain maps'}
                        sx={{ flexShrink: 0, p: 0.25 }}
                    >
                        <ChevronRightIcon
                            fontSize="small"
                            sx={{
                                transform: expanded ? 'rotate(90deg)' : 'none',
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
                        color={enabled ? (nameMissing ? 'warning.dark' : undefined) : 'text.disabled'}
                        noWrap
                        sx={{ lineHeight: 1.43 }}
                    >
                        {analysis.name || 'Untitled'}
                    </Typography>
                    <Typography
                        variant="caption"
                        component="div"
                        lineHeight={1.2}
                        color={enabled ? (descMissing ? 'warning.dark' : 'text.secondary') : 'text.disabled'}
                        sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            minHeight: '2.4em',
                        }}
                    >
                        {analysis.description || 'No description'}
                    </Typography>
                </Box>
                <IconButton
                    size="small"
                    onClick={(e) => {
                        e.stopPropagation();
                        onOpenMenu(e, analysis);
                    }}
                    aria-label="Analysis options"
                    sx={{ flexShrink: 0, p: 0.25, alignSelf: 'flex-start', mt: 0.25 }}
                >
                    <MoreVertIcon fontSize="small" />
                </IconButton>
            </Box>
        );
    },
    (prev, next) =>
        prev.row === next.row &&
        prev.analysis === next.analysis &&
        prev.mapsForParent === next.mapsForParent &&
        prev.selectedMapId === next.selectedMapId &&
        prev.analysisEnabled === next.analysisEnabled
);

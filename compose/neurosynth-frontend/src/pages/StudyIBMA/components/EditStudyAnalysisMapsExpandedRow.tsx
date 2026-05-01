import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { Box, Chip, IconButton, ListItemButton, ListItemText, TableCell, TableRow, Typography } from '@mui/material';
import type { Row, Table as TanstackTable } from '@tanstack/react-table';
import React from 'react';
import { DefaultMapTypes } from 'stores/study/StudyStore.helpers';
import { useStudyAnalysisImages } from 'stores/study/StudyStore';
import { imageToBrainMapListItem } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.helpers';
import type { AnalysisBoardRow } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.types';

export const EditStudyAnalysisMapsExpandedRow: React.FC<{
    row: Row<AnalysisBoardRow>;
    table: TanstackTable<AnalysisBoardRow>;
}> = ({ row, table }) => {
    const analysisId = row.original.id;
    const analysisImages = useStudyAnalysisImages(analysisId);
    const meta = table.options.meta;
    const selectedImageId = meta?.selectedImageId ?? null;
    const onSelectImage = meta?.toggleImageSelection;
    const onRemoveImage = meta?.removeImageFromAnalysis;
    const colSpan = table.getVisibleLeafColumns().length;

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
                        py: 1,
                        pl: 2,
                        pr: 2,
                        width: '100%',
                        boxSizing: 'border-box',
                    }}
                >
                    {analysisImages.length === 0 ? (
                        <Typography variant="caption" sx={{ color: 'warning.dark' }}>
                            No brain maps assigned to this analysis
                        </Typography>
                    ) : (
                        analysisImages.map((map) => {
                            const item = imageToBrainMapListItem(map);
                            if (!map.id) return null;
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
                                        selected={selectedImageId === map.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSelectImage?.(map.id!);
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
                                            }}
                                        />
                                    </ListItemButton>
                                    <IconButton
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRemoveImage?.(analysisId, map);
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
            </TableCell>
        </TableRow>
    );
};

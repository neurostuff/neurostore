import { Box, Paper, Skeleton } from '@mui/material';
import type { ImageReturn } from 'neurostore-typescript-sdk';
import useEditStudyAnalysisBoardState from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import BrainMapDetailPanel from 'pages/StudyIBMA/components/BrainMapDetailPanel';
import EditStudyAnalysisTable from 'pages/StudyIBMA/components/EditStudyAnalysisTable';
import UncategorizedImagesColumn from 'pages/StudyIBMA/components/UncategorizedImagesColumn';

const EditStudyAnalysisIBMA: React.FC = () => {
    const { table, tableMinWidth, uncategorized, noteKeys, isLoading } = useEditStudyAnalysisBoardState();

    const tableMeta = table.options.meta;
    const analyses = tableMeta?.analyses ?? [];
    const selectedImageId = tableMeta?.selectedImageId ?? null;
    const toggleImageSelection = tableMeta?.toggleImageSelection;
    const updateImage = tableMeta?.updateImage;

    const [uncategorizedCollapsed, setUncategorizedCollapsed] = useState(true);
    const initialLoad = useRef(false);
    useEffect(() => {
        if (isLoading || initialLoad.current) return;
        initialLoad.current = true;
        setUncategorizedCollapsed(uncategorized.length === 0);
    }, [isLoading, uncategorized]);

    const selectedImage = useMemo(() => {
        if (!selectedImageId) return undefined;

        const uncategorizedMatch = uncategorized.find((image) => image.id === selectedImageId);
        if (uncategorizedMatch) return uncategorizedMatch;

        const nestedImages = analyses.flatMap((analysis) => (analysis.images ?? []) as ImageReturn[]);
        return nestedImages.find((image) => image.id === selectedImageId);
    }, [selectedImageId, analyses, uncategorized]);

    return (
        <Box
            data-testid="edit-study-analysis-board"
            sx={{ display: 'flex', gap: 4, minWidth: 0, width: '100%', height: '100%' }}
        >
            {isLoading ? (
                <Skeleton sx={{ transform: 'none', height: '100%' }} />
            ) : (
                <UncategorizedImagesColumn
                    collapsed={uncategorizedCollapsed}
                    onCollapsedChange={setUncategorizedCollapsed}
                    uncategorized={uncategorized}
                    selectedImageId={selectedImageId}
                    onToggleImageSelection={(imageId) => toggleImageSelection?.(imageId)}
                    analyses={analyses}
                    updateImage={updateImage}
                />
            )}

            {isLoading ? (
                <Skeleton sx={{ transform: 'none', width: '100%', height: '100%' }} />
            ) : (
                <EditStudyAnalysisTable table={table} tableMinWidth={tableMinWidth} noteKeys={noteKeys} />
            )}

            {selectedImage && (
                <Paper
                    variant="elevation"
                    elevation={2}
                    sx={{
                        flex: '1 1 0',
                        minWidth: 250,
                        height: '100%',
                        minHeight: '100%',
                        overflow: 'auto',
                    }}
                >
                    <BrainMapDetailPanel
                        image={selectedImage}
                        onClose={() => toggleImageSelection?.()}
                        onEditImage={(fields) => {
                            if (!selectedImage.id) return;
                            return updateImage?.(selectedImage.id, fields);
                        }}
                    />
                </Paper>
            )}
        </Box>
    );
};

export default EditStudyAnalysisIBMA;

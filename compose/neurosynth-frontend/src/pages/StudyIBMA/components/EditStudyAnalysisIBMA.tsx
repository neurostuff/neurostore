import { Box, Skeleton } from '@mui/material';
import type { ImageReturn } from 'neurostore-typescript-sdk';
import useEditStudyAnalysisBoardState from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import BrainMapDetailPanel from 'pages/StudyIBMA/components/BrainMapDetailPanel';
import EditStudyAnalysisTable from 'pages/StudyIBMA/components/EditStudyAnalysisTable';
import UncategorizedMapsColumn from 'pages/StudyIBMA/components/UncategorizedMapsColumn';

const EditStudyAnalysisIBMA: React.FC = () => {
    const {
        toggleImageSelection,
        table,
        tableMinWidth,
        uncategorized,
        selectedImageId,
        analyses,
        noteKeys,
        createAnalysis,
        addAnnotationColumn,
        updateImage,
        isLoading,
    } = useEditStudyAnalysisBoardState();

    const [uncategorizedCollapsed, setUncategorizedCollapsed] = useState(true);
    const initialLoad = useRef(false);
    useEffect(() => {
        if (isLoading || initialLoad.current) return;
        initialLoad.current = true;
        setUncategorizedCollapsed(uncategorized.length === 0);
    }, []);

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
                <Skeleton sx={{ transform: 'none', width: '400px', height: '100%' }} />
            ) : (
                <UncategorizedMapsColumn
                    collapsed={uncategorizedCollapsed}
                    onCollapsedChange={setUncategorizedCollapsed}
                    uncategorized={uncategorized}
                    selectedImageId={table.options.meta?.selectedImageId ?? null}
                    onToggleMapSelection={(id) => table.options.meta?.toggleImageSelection?.(id)}
                    analyses={analyses ?? []}
                    updateImage={updateImage}
                />
            )}

            {isLoading ? (
                <Skeleton sx={{ transform: 'none', width: '100%', height: '100%' }} />
            ) : (
                <EditStudyAnalysisTable
                    table={table}
                    tableMinWidth={tableMinWidth}
                    noteKeys={noteKeys}
                    onCreateAnalysis={createAnalysis}
                    onAddAnnotationColumn={addAnnotationColumn}
                />
            )}

            {selectedImage && <BrainMapDetailPanel image={selectedImage} onClose={() => toggleImageSelection()} />}
        </Box>
    );
};

export default EditStudyAnalysisIBMA;

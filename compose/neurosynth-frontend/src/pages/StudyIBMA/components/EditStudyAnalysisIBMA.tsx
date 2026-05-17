import { Box, Skeleton } from '@mui/material';
import useEditStudyAnalysisBoardState from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState';
import { findImageById } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.helpers';
import React, { useMemo, useState } from 'react';
import { BrainMapDetailPanel } from './BrainMapDetailPanel';
import { EditStudyAnalysisTable } from './EditStudyAnalysisTable';
import { UncategorizedMapsColumn } from './UncategorizedMapsColumn';

const EditStudyAnalysisIBMA: React.FC = () => {
    const [uncategorizedCollapsed, setUncategorizedCollapsed] = useState(false);

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

    const selectedImage = useMemo(() => {
        return findImageById(selectedImageId, analyses);
    }, [selectedImageId, uncategorized]);

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

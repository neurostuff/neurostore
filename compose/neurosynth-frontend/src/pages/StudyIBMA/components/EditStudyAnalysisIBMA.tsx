import { Box } from '@mui/material';
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
        analysisIdToImageMap,
        analyses,
    } = useEditStudyAnalysisBoardState();

    const selectedImage = useMemo(() => {
        return findImageById(selectedImageId, analyses);
    }, [selectedImageId, uncategorized, analysisIdToImageMap]);

    return (
        <Box data-testid="edit-study-analysis-board" sx={{ display: 'flex', gap: 4, width: '100%' }}>
            <UncategorizedMapsColumn
                collapsed={uncategorizedCollapsed}
                onCollapsedChange={setUncategorizedCollapsed}
                uncategorized={uncategorized}
                selectedImageId={table.options.meta?.selectedImageId ?? null}
                onToggleMapSelection={(id) => table.options.meta?.toggleImageSelection?.(id)}
                analyses={analyses}
            />

            <EditStudyAnalysisTable table={table} tableMinWidth={tableMinWidth} />

            {selectedImage && <BrainMapDetailPanel image={selectedImage} onClose={() => toggleImageSelection()} />}
        </Box>
    );
};

export default EditStudyAnalysisIBMA;

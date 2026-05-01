import { Box, Typography } from '@mui/material';
import { createColumnHelper, getCoreRowModel, useReactTable, type ExpandedState } from '@tanstack/react-table';
import type { NoteKeyType } from 'components/HotTables/HotTables.types';
import type { ImageReturn } from 'neurostore-typescript-sdk';
import { AnalysisNameCell } from 'pages/StudyIBMA/components/AnalysisNameCell';
import { AnnotationColumnCell } from 'pages/StudyIBMA/components/AnnotationColumnCells';
import { AnnotationColumnHeader } from 'pages/StudyIBMA/components/AnnotationColumnHeader';
import { STUDY_ANALYSES_COLUMN_WIDTH } from 'pages/StudyIBMA/components/editStudyAnalysisBoard.constants';
import {
    partitionAnalysisImages,
    syncImageMutationsToStore,
    unassignBrainMapImageFromAnalysis,
} from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.helpers';
import 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.tableMeta';
import type { AnalysisBoardRow } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.types';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useAnnotationNoteKeys, useCreateAnnotationNote } from 'stores/annotation/AnnotationStore.actions';
import { useAnnotationNotes } from 'stores/annotation/AnnotationStore.getters';
import type { IStoreNoteCollectionReturn } from 'stores/annotation/AnnotationStore.types';
import { useAddOrUpdateAnalysis, useStudyAnalyses, useStudyId } from 'stores/study/StudyStore';

const columnHelper = createColumnHelper<AnalysisBoardRow>();

const useEditStudyAnalysisBoardState = () => {
    const analyses = useStudyAnalyses();
    const studyId = useStudyId();
    const noteKeys = useAnnotationNoteKeys();
    const notes = useAnnotationNotes();
    const addOrUpdateAnalysis = useAddOrUpdateAnalysis();
    const createAnnotationNote = useCreateAnnotationNote();

    const analysisIdToNoteMap = useMemo(() => {
        const m = new Map<string, IStoreNoteCollectionReturn>();
        (notes || []).forEach((n) => {
            if (n.analysis) m.set(n.analysis, n);
        });
        return m;
    }, [notes]);

    const { uncategorized, analysisIdToImageMap } = useMemo(() => partitionAnalysisImages(analyses), [analyses]);

    const [selectedImageId, setSelectedImageId] = useState<string | undefined>();

    const toggleImageSelection = useCallback((imageId?: string) => {
        setSelectedImageId((prev) => (prev === imageId ? undefined : imageId));
    }, []);

    const [expanded, setExpanded] = useState<ExpandedState>({});

    const tableData = useMemo((): AnalysisBoardRow[] => {
        return analyses.map((analysis) => {
            const id = analysis.id!;
            const note = analysisIdToNoteMap.get(id);
            const analysisNote = (note?.note || {}) as Record<string, string | boolean | number | null | undefined>;
            const annotation = Object.fromEntries(
                (noteKeys || []).map(({ key }) => [key, analysisNote[key] ?? null])
            ) as Record<string, string | boolean | number | null | undefined>;

            return {
                id,
                name: analysis.name ?? '',
                description: analysis.description ?? '',
                annotation,
            };
        });
    }, [analyses, analysisIdToNoteMap, noteKeys]);

    const analysesRef = useRef(analyses);
    analysesRef.current = analyses;

    const handleRemoveMapFromAnalysis = useCallback(
        (analysisId: string, map: ImageReturn) => {
            const before = analysesRef.current;
            if (!map.id) return;
            const next = unassignBrainMapImageFromAnalysis(before, analysisId, map.id);
            syncImageMutationsToStore(before, next, addOrUpdateAnalysis);
            if (selectedImageId === map.id) setSelectedImageId(undefined);
        },
        [addOrUpdateAnalysis, selectedImageId]
    );

    const tableMeta = useMemo(
        () => ({
            selectedImageId,
            toggleImageSelection,
            removeImageFromAnalysis: handleRemoveMapFromAnalysis,
        }),
        [selectedImageId, toggleImageSelection, handleRemoveMapFromAnalysis]
    );

    const columns = useMemo(
        () => [
            columnHelper.display({
                id: 'analysis',
                header: () => (
                    <Box
                        sx={{
                            display: 'flex',
                            gap: 0.5,
                        }}
                    >
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mr: 1 }}>
                            Analyses
                        </Typography>
                    </Box>
                ),
                cell: AnalysisNameCell,
                size: STUDY_ANALYSES_COLUMN_WIDTH,
            }),
            ...(noteKeys || []).map((noteKey: NoteKeyType) =>
                columnHelper.accessor((row) => row.annotation[noteKey.key] ?? null, {
                    id: noteKey.key,
                    header: () => <AnnotationColumnHeader headerName={noteKey.key} />,
                    cell: AnnotationColumnCell,
                    size: 120,
                    minSize: 112,
                    meta: {
                        editStudyAnalysisTableNoteKey: noteKey,
                    },
                })
            ),
        ],
        [noteKeys]
    );

    const table = useReactTable({
        data: tableData,
        columns,
        state: { expanded },
        onExpandedChange: setExpanded,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row) => row.id,
        getRowCanExpand: () => true,
        meta: tableMeta,
    });

    const tableMinWidth = STUDY_ANALYSES_COLUMN_WIDTH + (noteKeys?.length ?? 0) * 112;

    return {
        table,
        tableMinWidth,
        uncategorized,
        analysisIdToImageMap,
        toggleImageSelection,
        selectedImageId,
        analyses,
    };
};

export default useEditStudyAnalysisBoardState;

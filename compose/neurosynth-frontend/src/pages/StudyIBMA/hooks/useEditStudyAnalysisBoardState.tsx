import { Box, Typography } from '@mui/material';
import { createColumnHelper, getCoreRowModel, useReactTable, type ExpandedState } from '@tanstack/react-table';
import type { NoteKeyType } from 'components/HotTables/HotTables.types';
import { noteKeyObjToArr } from 'components/HotTables/HotTables.utils';
import { useGetAnalysesByStudyId, useGetAnnotationById } from 'hooks';
import type { ImageReturn, NoteCollectionReturn } from 'neurostore-typescript-sdk';
import AnalysisNameCell from 'pages/StudyIBMA/components/AnalysisNameCell';
import { AnnotationColumnCell } from 'pages/StudyIBMA/components/AnnotationColumnCells';
import { AnnotationColumnHeader } from 'pages/StudyIBMA/components/AnnotationColumnHeader';
import { STUDY_ANALYSES_COLUMN_WIDTH } from 'pages/StudyIBMA/components/editStudyAnalysisBoard.constants';
import { partitionAnalysisImages } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.helpers';
import 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.tableMeta';
import type { AnalysisBoardRow } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.types';
import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useProjectExtractionAnnotationId } from 'stores/projects/ProjectStore';

const columnHelper = createColumnHelper<AnalysisBoardRow>();

const useEditStudyAnalysisBoardState = () => {
    const annotationId = useProjectExtractionAnnotationId();
    const { studyId } = useParams<{ projectId: string; studyId: string }>();
    const { data: analysesRes, isLoading: getAnalysesIsLoading } = useGetAnalysesByStudyId(studyId);
    const { data: annotation, isLoading: getAnnotationIsLoading } = useGetAnnotationById(annotationId);

    const stableAnalyses = useMemo(() => analysesRes ?? [], [analysesRes]);

    const analysisIdToNoteMap = useMemo(() => {
        const m = new Map<string, NoteCollectionReturn>();
        (annotation?.notes || []).forEach((n) => {
            if (n.analysis) m.set(n.analysis, n);
        });
        return m;
    }, [annotation?.notes]);

    const { uncategorized, analysisIdToImageMap } = useMemo(
        () => partitionAnalysisImages(stableAnalyses ?? []),
        [stableAnalyses]
    );

    const [selectedImageId, setSelectedImageId] = useState<string | undefined>();

    const noteKeys = useMemo(() => noteKeyObjToArr(annotation?.note_keys), [annotation?.note_keys]);

    const toggleImageSelection = useCallback((imageId?: string) => {
        setSelectedImageId((prev) => (prev === imageId ? undefined : imageId));
    }, []);

    const [expanded, setExpanded] = useState<ExpandedState>({});

    const tableData = useMemo((): AnalysisBoardRow[] => {
        return (stableAnalyses ?? []).map((analysis) => {
            const id = analysis.id!;
            const note = analysisIdToNoteMap.get(id);
            const analysisNote = (note?.note || {}) as Record<string, string | boolean | number | null | undefined>;
            const analysisAnnotation = Object.fromEntries(
                (noteKeys ?? []).map(({ key }) => [key, analysisNote[key] ?? null])
            ) as Record<string, string | boolean | number | null | undefined>;

            return {
                ...analysis,
                analysisAnnotation,
            };
        });
    }, [stableAnalyses, analysisIdToNoteMap, noteKeys]);

    const handleRemoveImageFromAnalysis = useCallback(
        (analysisId: string, image: ImageReturn) => {
            // const before = analysesRef.current;
            // if (!image.id) return;
            // const next = unassignBrainMapImageFromAnalysis(before, analysisId, image.id);
            // syncImageMutationsToStore(before, next, addOrUpdateAnalysis);
            // if (selectedImageId === image.id) setSelectedImageId(undefined);
        },
        [selectedImageId]
    );

    const tableMeta = useMemo(
        () => ({
            selectedImageId,
            toggleImageSelection,
            removeImageFromAnalysis: handleRemoveImageFromAnalysis,
        }),
        [selectedImageId, toggleImageSelection, handleRemoveImageFromAnalysis]
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
            }),
            ...(noteKeys || []).map((noteKey: NoteKeyType) =>
                columnHelper.accessor((row) => row.analysisAnnotation[noteKey.key] ?? null, {
                    id: noteKey.key,
                    header: () => <AnnotationColumnHeader headerName={noteKey.key} />,
                    cell: AnnotationColumnCell,
                    size: 80,
                    minSize: 80,
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
        getRowId: (row) => row.id ?? '',
        getRowCanExpand: () => true,
        meta: tableMeta,
    });

    const tableMinWidth = STUDY_ANALYSES_COLUMN_WIDTH + (noteKeys?.length ?? 0) * 112;

    return {
        table,
        tableMinWidth,
        uncategorized,
        toggleImageSelection,
        selectedImageId,
        analyses: stableAnalyses,
        isLoading: getAnnotationIsLoading || getAnalysesIsLoading,
    };
};

export default useEditStudyAnalysisBoardState;

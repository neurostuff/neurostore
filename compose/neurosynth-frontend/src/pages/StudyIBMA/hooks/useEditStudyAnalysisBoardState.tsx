import { Box, Typography } from '@mui/material';
import { createColumnHelper, getCoreRowModel, useReactTable, type ExpandedState } from '@tanstack/react-table';
import type { NoteKeyType } from 'components/HotTables/HotTables.types';
import { noteKeyObjToArr } from 'components/HotTables/HotTables.utils';
import type { AnalysisReturnNested } from 'hooks/analyses/analysisQueries.types';
import { useGetAnalysesByStudyId, useGetAnnotationById, useGetUncategorizedImagesByStudyId } from 'hooks';
import type { ImageReturn, NoteCollectionReturn } from 'neurostore-typescript-sdk';
import AnalysisNameCell from 'pages/StudyIBMA/components/AnalysisNameCell';
import AnnotationBaseInputCell from 'pages/StudyIBMA/components/AnnotationInputCells';
import AnnotationColumnHeader from 'pages/StudyIBMA/components/AnnotationColumnHeader';
import { STUDY_ANALYSES_COLUMN_WIDTH } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.consts';
import 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.tableMeta';
import type { AnalysisBoardRow } from 'pages/StudyIBMA/hooks/useEditStudyAnalysisBoardState.types';
import useIbmaBoardMutations from 'pages/StudyIBMA/hooks/useIbmaBoardMutations';
import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useProjectExtractionAnnotationId } from 'stores/projects/ProjectStore';
import { sortAnalysesByOrder, sortImages } from './useEditStudyAnalysisBoardState.helpers';

const columnHelper = createColumnHelper<AnalysisBoardRow>();

// stable references to empty arrays
const EMPTY_ANALYSES: AnalysisReturnNested[] = [];
const EMPTY_UNCATEGORIZED_IMAGES: ImageReturn[] = [];

const useEditStudyAnalysisBoardState = () => {
    const annotationId = useProjectExtractionAnnotationId();
    const { studyId } = useParams<{ projectId: string; studyId: string }>();
    const { data: analysesRes, isLoading: getAnalysesIsLoading } = useGetAnalysesByStudyId(studyId);
    const { data: uncategorizedRes, isLoading: getUncategorizedImagesIsLoading } =
        useGetUncategorizedImagesByStudyId(studyId);
    const { data: annotation, isLoading: getAnnotationIsLoading } = useGetAnnotationById(annotationId);

    const analyses = analysesRes ?? EMPTY_ANALYSES;
    const uncategorized = uncategorizedRes ?? EMPTY_UNCATEGORIZED_IMAGES;

    const {
        createAnalysis,
        updateAnalysis,
        deleteAnalysis,
        addAnnotationColumn,
        removeAnnotationColumn,
        updateAnnotationCell,
        updateImage,
    } = useIbmaBoardMutations({
        studyId,
        annotationId,
        annotation,
    });

    const analysisIdToNoteMap = useMemo(() => {
        const m = new Map<string, NoteCollectionReturn>();
        (annotation?.notes || []).forEach((n) => {
            if (n.analysis) m.set(n.analysis, n);
        });
        return m;
    }, [annotation?.notes]);

    const [selectedImageId, setSelectedImageId] = useState<string | undefined>();

    const noteKeys = useMemo(() => noteKeyObjToArr(annotation?.note_keys), [annotation?.note_keys]);

    const toggleImageSelection = useCallback((imageId?: string) => {
        setSelectedImageId((prev) => (prev === imageId ? undefined : imageId));
    }, []);

    const [expanded, setExpanded] = useState<ExpandedState>({});

    const tableData = useMemo((): AnalysisBoardRow[] => {
        const analysisRows = analyses.map((analysis) => {
            const id = analysis.id!;
            const note = analysisIdToNoteMap.get(id);
            const analysisNote = (note?.note || {}) as Record<string, string | boolean | number | null | undefined>;
            const analysisAnnotation = Object.fromEntries(
                (noteKeys ?? []).map(({ key }) => [key, analysisNote[key] ?? null])
            ) as Record<string, string | boolean | number | null | undefined>;

            return {
                ...analysis,
                images: sortImages(analysis.images ?? []),
                analysisAnnotation,
            };
        });

        return sortAnalysesByOrder(analysisRows);
    }, [analyses, analysisIdToNoteMap, noteKeys]);

    const tableMeta = useMemo(
        () => ({
            selectedImageId: selectedImageId ?? null,
            analyses,
            toggleImageSelection,
            updateImage,
            createAnalysis,
            addAnnotationColumn,
            deleteAnalysis,
            updateAnalysis,
            updateAnnotationCell,
        }),
        [
            selectedImageId,
            toggleImageSelection,
            analyses,
            updateImage,
            createAnalysis,
            addAnnotationColumn,
            deleteAnalysis,
            updateAnalysis,
            updateAnnotationCell,
        ]
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
                            Analyses ({analyses.length})
                        </Typography>
                    </Box>
                ),
                cell: AnalysisNameCell,
            }),
            ...(noteKeys || []).map((noteKey: NoteKeyType) =>
                columnHelper.accessor((row) => row.analysisAnnotation[noteKey.key] ?? null, {
                    id: noteKey.key,
                    header: () => (
                        <AnnotationColumnHeader
                            headerName={noteKey.key}
                            columnType={noteKey.type}
                            onRemoveColumn={removeAnnotationColumn}
                        />
                    ),
                    cell: AnnotationBaseInputCell,
                    size: 80,
                    minSize: 80,
                    meta: {
                        editStudyAnalysisTableNoteKey: noteKey,
                    },
                })
            ),
        ],
        [noteKeys, removeAnnotationColumn]
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
        noteKeys,
        isLoading: getAnnotationIsLoading || getAnalysesIsLoading || getUncategorizedImagesIsLoading,
    };
};

export default useEditStudyAnalysisBoardState;

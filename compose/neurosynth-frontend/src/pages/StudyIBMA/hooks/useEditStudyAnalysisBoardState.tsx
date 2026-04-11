import { Add } from '@mui/icons-material';
import { Box, Button, Typography } from '@mui/material';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { EPropertyType } from 'components/EditMetadata/EditMetadata.types';
import type { NoteKeyType } from 'components/HotTables/HotTables.types';
import type { ImageReturn } from 'neurostore-typescript-sdk';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useAnnotationStore } from 'stores/annotation/AnnotationStore';
import {
    useAnnotationNoteKeys,
    useCreateAnnotationNote,
    useDeleteAnnotationNote,
    useUpdateAnnotationNotes,
} from 'stores/annotation/AnnotationStore.actions';
import { useAnnotationNotes } from 'stores/annotation/AnnotationStore.getters';
import type { IStoreNoteCollectionReturn } from 'stores/annotation/AnnotationStore.types';
import {
    useAddOrUpdateAnalysis,
    useDeleteAnalysis,
    useStudyAnalyses,
    useStudyId,
} from 'stores/study/StudyStore';
import type { IStoreAnalysis } from 'stores/study/StudyStore.helpers';
import { AnnotationColumnCell, useStableAnnotationColumnCommit } from 'pages/StudyIBMA/components/AnnotationColumnCells';
import { AnnotationColumnHeader } from 'pages/StudyIBMA/components/AnnotationColumnHeader';
import {
    STUDY_ANALYSES_COLUMN_WIDTH,
    STUDY_BRAIN_MAPS_DETAIL_ROW_SUFFIX,
} from 'pages/StudyIBMA/components/editStudyAnalysisBoard.constants';
import {
    findBrainMapImageById,
    moveBrainMapImageToAnalysis,
    normalizeAnalysisImages,
    partitionAnalysisImages,
    unassignBrainMapImageFromAnalysis,
} from 'pages/StudyIBMA/components/editStudyAnalysisBoard.helpers';
import type { AnalysisBoardRow } from 'pages/StudyIBMA/components/editStudyAnalysisBoard.types';

const columnHelper = createColumnHelper<AnalysisBoardRow>();

const EMPTY_IMAGES: ImageReturn[] = [];

function noteTypeToCellType(t: EPropertyType): 'boolean' | 'string' | 'number' {
    if (t === EPropertyType.BOOLEAN) return 'boolean';
    if (t === EPropertyType.NUMBER) return 'number';
    return 'string';
}

function imagesFingerprint(images: IStoreAnalysis['images'] | undefined): string {
    return normalizeAnalysisImages(images)
        .map((i) => `${i.id ?? ''}:${i.analysis ?? ''}`)
        .sort()
        .join('|');
}

function syncImageMutationsToStore(
    before: IStoreAnalysis[],
    after: IStoreAnalysis[],
    addOrUpdateAnalysis: ReturnType<typeof useAddOrUpdateAnalysis>
) {
    const oldById = new Map(before.filter((a) => a.id).map((a) => [a.id!, a]));
    after.forEach((upd) => {
        if (!upd.id) return;
        const old = oldById.get(upd.id);
        if (!old) return;
        if (imagesFingerprint(old.images) !== imagesFingerprint(upd.images)) {
            addOrUpdateAnalysis({ id: upd.id, images: upd.images });
        }
    });
}

function analysisRowsShallowEqual(a: AnalysisBoardRow, b: AnalysisBoardRow): boolean {
    if (a.rowKind !== 'analysis' || b.rowKind !== 'analysis') return false;
    if (a.id !== b.id || a.isExpanded !== b.isExpanded) return false;
    if (a.name !== b.name || a.description !== b.description) return false;
    const ak = Object.keys(a.annotation);
    const bk = Object.keys(b.annotation);
    if (ak.length !== bk.length) return false;
    for (const k of ak) {
        if (a.annotation[k] !== b.annotation[k]) return false;
    }
    return true;
}

export function useEditStudyAnalysisBoardState() {
    const analyses = useStudyAnalyses();
    const studyId = useStudyId();
    const addOrUpdateAnalysis = useAddOrUpdateAnalysis();
    const deleteAnalysis = useDeleteAnalysis();
    const createAnnotationNote = useCreateAnnotationNote();
    const deleteAnnotationNote = useDeleteAnnotationNote();
    const noteKeys = useAnnotationNoteKeys();
    const notes = useAnnotationNotes();
    const updateNotes = useUpdateAnnotationNotes();

    const noteByAnalysisId = useMemo(() => {
        const m = new Map<string, IStoreNoteCollectionReturn>();
        (notes || []).forEach((n) => {
            if (n.analysis) m.set(n.analysis, n);
        });
        return m;
    }, [notes]);

    const { uncategorized, byAnalysisId } = useMemo(() => partitionAnalysisImages(analyses), [analyses]);

    const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
    const toggleMapSelection = useCallback((mapId: string) => {
        setSelectedMapId((prev) => (prev === mapId ? null : mapId));
    }, []);

    const [analysisEnabled] = useState<Record<string, boolean>>({});
    const [moveAnchorEl, setMoveAnchorEl] = useState<{ el: HTMLElement; mapId: string } | null>(null);
    const [analysisMenuAnchor, setAnalysisMenuAnchor] = useState<{
        el: HTMLElement;
        analysis: IStoreAnalysis;
    } | null>(null);
    const [editModalAnalysis, setEditModalAnalysis] = useState<IStoreAnalysis | null>(null);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [deleteConfirmAnalysisId, setDeleteConfirmAnalysisId] = useState<string | null>(null);
    const [uncategorizedCollapsed, setUncategorizedCollapsed] = useState(false);
    const [expandedAnalysisIds, setExpandedAnalysisIds] = useState<Set<string>>(() => new Set());

    const [annotationEdits, setAnnotationEdits] = useState<
        Record<string, Partial<Record<string, string | boolean | number>>>
    >({});
    const annotationEditsRef = useRef(annotationEdits);
    annotationEditsRef.current = annotationEdits;

    const getAnnotationDisplayValue = useCallback((row: AnalysisBoardRow, field: string) => {
        if (row.rowKind === 'detail') return undefined;
        const edited = annotationEditsRef.current[row.id]?.[field];
        if (edited !== undefined) return edited;
        return row.annotation[field];
    }, []);

    const commitAnnotationDisplayValue = useCallback(
        (rowId: string, field: string, value: string | boolean | number) => {
            setAnnotationEdits((prev) => ({
                ...prev,
                [rowId]: { ...prev[rowId], [field]: value },
            }));
        },
        []
    );

    const persistAnnotationToStore = useCallback(
        (analysisId: string, field: string, value: string | boolean | number) => {
            const currentNotes = useAnnotationStore.getState().annotation.notes;
            if (!currentNotes) return;
            const idx = currentNotes.findIndex((n) => n.analysis === analysisId);
            if (idx < 0) return;
            const prevNote = currentNotes[idx];
            const nextNote = {
                ...prevNote,
                note: {
                    ...(prevNote.note as Record<string, string | boolean | number | null>),
                    [field]: value,
                },
                isEdited: true,
            };
            const merged = [...currentNotes];
            merged[idx] = nextNote;
            updateNotes(merged);
        },
        [updateNotes]
    );

    const commitAnnotation = useCallback(
        (rowId: string, field: string, value: string | boolean | number) => {
            commitAnnotationDisplayValue(rowId, field, value);
            persistAnnotationToStore(rowId, field, value);
        },
        [commitAnnotationDisplayValue, persistAnnotationToStore]
    );

    const stableCommit = useStableAnnotationColumnCommit(commitAnnotation);

    const toggleAnalysisExpanded = useCallback((analysisId: string) => {
        setExpandedAnalysisIds((prev) => {
            const next = new Set(prev);
            if (next.has(analysisId)) next.delete(analysisId);
            else next.add(analysisId);
            return next;
        });
    }, []);

    const prevTableRowsRef = useRef<AnalysisBoardRow[]>([]);

    const tableData = useMemo((): AnalysisBoardRow[] => {
        const prevById = new Map(prevTableRowsRef.current.map((r) => [r.id, r]));
        const rows: AnalysisBoardRow[] = [];

        analyses.forEach((a) => {
            const id = a.id!;
            const note = noteByAnalysisId.get(id);
            const noteObj = (note?.note || {}) as Record<string, string | boolean | number | null | undefined>;
            const annotation: Record<string, string | boolean | number | null | undefined> = {};
            (noteKeys || []).forEach((nk) => {
                annotation[nk.key] = noteObj[nk.key] ?? null;
            });

            const expanded = expandedAnalysisIds.has(id);
            const candidate: AnalysisBoardRow = {
                id,
                rowKind: 'analysis',
                isExpanded: expanded,
                name: a.name ?? '',
                description: a.description ?? '',
                annotation,
            };
            const old = prevById.get(id);
            if (old && old.rowKind === 'analysis' && analysisRowsShallowEqual(old, candidate)) {
                rows.push(old);
            } else {
                rows.push(candidate);
            }

            if (expanded) {
                const detailId = `${id}${STUDY_BRAIN_MAPS_DETAIL_ROW_SUFFIX}`;
                const detailCandidate: AnalysisBoardRow = {
                    id: detailId,
                    rowKind: 'detail',
                    parentAnalysisId: id,
                    name: '',
                    description: '',
                    annotation: {},
                };
                const oldDetail = prevById.get(detailId);
                if (oldDetail && oldDetail.rowKind === 'detail') {
                    rows.push(oldDetail);
                } else {
                    rows.push(detailCandidate);
                }
            }
        });

        prevTableRowsRef.current = rows;
        return rows;
    }, [analyses, expandedAnalysisIds, noteByAnalysisId, noteKeys]);

    const handleCreateNewAnalysis = useCallback(() => {
        if (!studyId) return;
        const createdAnalysis = addOrUpdateAnalysis({
            name: '',
            description: '',
            isNew: true,
            conditions: [],
            order: analyses.length + 1,
            images: [],
        });
        if (!createdAnalysis.id) return;
        createAnnotationNote(createdAnalysis.id, studyId, '');
    }, [studyId, addOrUpdateAnalysis, analyses.length, createAnnotationNote]);

    const handleMoveClick = useCallback((event: React.MouseEvent<HTMLElement>, mapId: string) => {
        event.stopPropagation();
        setMoveAnchorEl({ el: event.currentTarget, mapId });
    }, []);

    const analysesRef = useRef(analyses);
    analysesRef.current = analyses;

    const applyMoveImageToAnalysis = useCallback(
        (mapId: string, analysisId: string) => {
            setMoveAnchorEl(null);
            const before = analysesRef.current;
            const next = moveBrainMapImageToAnalysis(before, mapId, analysisId);
            if (!next) return;
            syncImageMutationsToStore(before, next, addOrUpdateAnalysis);
        },
        [addOrUpdateAnalysis]
    );

    const handleAnalysisMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>, analysis: IStoreAnalysis) => {
        event.stopPropagation();
        setAnalysisMenuAnchor({ el: event.currentTarget, analysis });
    }, []);

    const handleAnalysisMenuClose = useCallback(() => {
        setAnalysisMenuAnchor(null);
    }, []);

    const handleEditAnalysis = useCallback(() => {
        const a = analysisMenuAnchor?.analysis;
        if (!a) return;
        setEditModalAnalysis(a);
        setEditName(a.name ?? '');
        setEditDescription(a.description ?? '');
        setAnalysisMenuAnchor(null);
    }, [analysisMenuAnchor?.analysis]);

    const handleCloseEditModal = useCallback(() => {
        setEditModalAnalysis(null);
        setEditName('');
        setEditDescription('');
    }, []);

    const handleSaveEditAnalysis = useCallback(() => {
        if (!editModalAnalysis?.id) return;
        addOrUpdateAnalysis({
            id: editModalAnalysis.id,
            name: editName,
            description: editDescription,
        });
        handleCloseEditModal();
    }, [addOrUpdateAnalysis, editModalAnalysis?.id, editName, editDescription, handleCloseEditModal]);

    const handleDeleteAnalysisClick = useCallback(() => {
        const id = analysisMenuAnchor?.analysis?.id;
        if (id) setDeleteConfirmAnalysisId(id);
        setAnalysisMenuAnchor(null);
    }, [analysisMenuAnchor?.analysis?.id]);

    const handleDeleteConfirm = useCallback(
        (confirm: boolean | undefined) => {
            if (confirm && deleteConfirmAnalysisId) {
                deleteAnalysis(deleteConfirmAnalysisId);
                deleteAnnotationNote(deleteConfirmAnalysisId);
                const assigned = byAnalysisId[deleteConfirmAnalysisId] ?? [];
                if (selectedMapId && assigned.some((m) => m.id === selectedMapId)) {
                    setSelectedMapId(null);
                }
            }
            setDeleteConfirmAnalysisId(null);
        },
        [deleteAnalysis, deleteAnnotationNote, deleteConfirmAnalysisId, selectedMapId, byAnalysisId]
    );

    const handleRemoveMapFromAnalysis = useCallback(
        (analysisId: string, map: ImageReturn) => {
            const before = analysesRef.current;
            if (!map.id) return;
            const next = unassignBrainMapImageFromAnalysis(before, analysisId, map.id);
            syncImageMutationsToStore(before, next, addOrUpdateAnalysis);
            if (selectedMapId === map.id) setSelectedMapId(null);
        },
        [addOrUpdateAnalysis, selectedMapId]
    );

    const selectedBrainMap = useMemo(
        () =>
            selectedMapId ? findBrainMapImageById(selectedMapId, uncategorized, byAnalysisId) : undefined,
        [selectedMapId, uncategorized, byAnalysisId]
    );

    const annotationColumns = useMemo(() => {
        return (noteKeys || []).map((col: NoteKeyType) =>
            columnHelper.display({
                id: col.key,
                header: () => <AnnotationColumnHeader headerName={col.key} />,
                cell: (info) => {
                    const row = info.row.original;
                    const value = getAnnotationDisplayValue(row, col.key);
                    return (
                        <AnnotationColumnCell
                            rowId={row.id}
                            rowKind={row.rowKind}
                            field={col.key}
                            type={noteTypeToCellType(col.type)}
                            headerLabel={col.key}
                            initialValue={value as string | boolean | number | undefined}
                            onCommit={stableCommit}
                        />
                    );
                },
                size: 120,
                minSize: 112,
            })
        );
    }, [getAnnotationDisplayValue, noteKeys, stableCommit]);

    const columns = useMemo(
        () => [
            columnHelper.display({
                id: 'analysis',
                header: () => (
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 0.5,
                            minWidth: STUDY_ANALYSES_COLUMN_WIDTH - 24,
                        }}
                    >
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mr: 1 }}>
                            Analyses
                        </Typography>
                        <Button
                            size="small"
                            sx={{ fontSize: '10px' }}
                            variant="contained"
                            disableElevation
                            onClick={handleCreateNewAnalysis}
                        >
                            <Add sx={{ fontSize: '16px' }} />
                            Analysis
                        </Button>
                    </Box>
                ),
                cell: () => null,
                size: STUDY_ANALYSES_COLUMN_WIDTH,
            }),
            ...annotationColumns,
        ],
        [annotationColumns, handleCreateNewAnalysis]
    );

    const table = useReactTable({
        data: tableData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row) => row.id,
    });

    const tableMinWidth = STUDY_ANALYSES_COLUMN_WIDTH + (noteKeys?.length ?? 0) * 112;

    return {
        table,
        tableMinWidth,
        uncategorized,
        byAnalysisId,
        EMPTY_IMAGES,
        selectedMapId,
        toggleMapSelection,
        selectedBrainMap,
        analysisEnabled,
        uncategorizedCollapsed,
        setUncategorizedCollapsed,
        moveAnchorEl,
        handleMoveClick,
        applyMoveImageToAnalysis,
        handleMoveMenuClose: () => setMoveAnchorEl(null),
        analyses,
        toggleAnalysisExpanded,
        handleAnalysisMenuOpen,
        analysisMenuAnchor,
        handleAnalysisMenuClose,
        handleEditAnalysis,
        handleDeleteAnalysisClick,
        editModalAnalysis,
        editName,
        setEditName,
        editDescription,
        setEditDescription,
        handleCloseEditModal,
        handleSaveEditAnalysis,
        deleteConfirmAnalysisId,
        handleDeleteConfirm,
        handleRemoveMapFromAnalysis,
    };
}

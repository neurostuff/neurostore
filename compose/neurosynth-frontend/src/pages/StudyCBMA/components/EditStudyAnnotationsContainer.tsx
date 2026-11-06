import { HotTableRef } from '@handsontable/react-wrapper';
import { Box } from '@mui/material';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import AddMetadataRow from 'components/EditMetadata/AddMetadataRow';
import { EPropertyType, getType, IMetadataRowModel } from 'components/EditMetadata/EditMetadata.types';
import { AnnotationNoteType, AnnotationNoteValue, NoteKeyType } from 'components/HotTables/HotTables.types';
import { getDefaultForNoteKey } from 'components/HotTables/HotTables.utils';
import { useUserCanEdit } from 'hooks';
import { PendingAnnotationEdits } from 'pages/Annotations/components/EditAnnotationsHotTable';
import EditStudyAnnotationsHotTable from 'pages/StudyCBMA/components/EditStudyAnnotationsHotTable';
import {
    createStudyAnnotationColumnSettings,
    STUDY_ANNOTATIONS_SYNC_SOURCE,
} from 'pages/StudyCBMA/components/EditStudyAnnotationsHotTable.helpers';
import { EditStudyAnnotationsNoteCollectionReturn } from 'pages/StudyCBMA/components/EditStudyAnnotationsHotTable.types';
import { useStudyCBMAContext } from 'pages/StudyCBMA/context/StudyCBMAContext';
import useEditStudyAnnotationsHotTable from 'pages/StudyCBMA/hooks/useEditStudyAnnotationsHotTable';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useProjectUser } from 'stores/projects/ProjectStore';

/** Add and remove column controls around the study annotations table, plus the handle that Save and the analysis buttons call. */
const EditStudyAnnotationsContainer = ({ readonly = false }: { readonly?: boolean }) => {
    const hotTableRef = useRef<HotTableRef>(null);
    const pendingEditsRef = useRef<PendingAnnotationEdits>({
        noteKeys: [],
        dirtyRowIndexes: new Set(),
        noteKeysHaveChanged: false,
    });
    const { studyAnnotationsTableRef, setAnnotationHasEdits } = useStudyCBMAContext();
    const snapshot = useEditStudyAnnotationsHotTable(readonly);
    const projectUser = useProjectUser();
    const canEdit = useUserCanEdit(projectUser || undefined);
    const [confirmationDialogState, setConfirmationDialogState] = useState({
        isOpen: false,
        colKey: '',
    });

    useEffect(() => {
        if (!snapshot) return;
        pendingEditsRef.current = {
            noteKeys: snapshot.noteKeys,
            dirtyRowIndexes: new Set(),
            noteKeysHaveChanged: false,
        };

        // the source rows keep analysis, study and isNew, which are not columns
        const getSourceRows = () =>
            (hotTableRef.current?.hotInstance?.getSourceData() ?? []) as EditStudyAnnotationsNoteCollectionReturn[];
        const findAnalysisRowIndex = (analysisId: string) =>
            getSourceRows().findIndex((sourceRow) => sourceRow.analysis === analysisId);

        studyAnnotationsTableRef.current = {
            getAnnotationEdits: () => {
                const hot = hotTableRef.current?.hotInstance;
                if (!hot) return undefined;

                const pendingEdits = pendingEditsRef.current;
                const hotData = hot.getData() as AnnotationNoteValue[][];
                const sourceRows = getSourceRows();

                // the first two columns are the analysis name and analysis description
                const rows = hotData.map((rowValues, rowIndex) => {
                    const note: AnnotationNoteType = {};
                    pendingEdits.noteKeys.forEach((noteKey, index) => {
                        note[noteKey.key] = rowValues[index + 2];
                    });
                    return { ...sourceRows[rowIndex], note };
                });

                return {
                    noteKeys: pendingEdits.noteKeys,
                    rows,
                    editedRowIndexes: new Set(pendingEdits.dirtyRowIndexes),
                    noteKeysHaveChanged: pendingEdits.noteKeysHaveChanged,
                };
            },
            markSaved: (tempIdToAnalysisId) => {
                pendingEditsRef.current.dirtyRowIndexes = new Set();
                pendingEditsRef.current.noteKeysHaveChanged = false;
                const hot = hotTableRef.current?.hotInstance;
                if (!tempIdToAnalysisId || !hot) return;

                const savedAnalysisChanges: [number, string, string | boolean][] = [];
                getSourceRows().forEach((sourceRow, rowIndex) => {
                    const savedAnalysisId = tempIdToAnalysisId.get(sourceRow.analysis);
                    if (!savedAnalysisId) return;
                    savedAnalysisChanges.push([rowIndex, 'analysis', savedAnalysisId], [rowIndex, 'isNew', false]);
                });
                hot.setDataAtRowProp(savedAnalysisChanges, STUDY_ANNOTATIONS_SYNC_SOURCE);
            },
            insertAnalysisRow: (analysisId, studyId, analysisName) => {
                const hot = hotTableRef.current?.hotInstance;
                if (!hot) return;
                const rowIndex = hot.countRows();
                hot.alter('insert_row_below', undefined, 1, STUDY_ANNOTATIONS_SYNC_SOURCE);
                hot.setDataAtRowProp(
                    [
                        [rowIndex, 'analysis', analysisId],
                        [rowIndex, 'study', studyId],
                        [rowIndex, 'isNew', true],
                        [rowIndex, 'analysis_name', analysisName],
                        [rowIndex, 'analysisDescription', ''],
                        ...pendingEditsRef.current.noteKeys.map((noteKey) => [
                            rowIndex,
                            `note.${noteKey.key}`,
                            noteKey.default ?? null,
                        ]),
                    ],
                    STUDY_ANNOTATIONS_SYNC_SOURCE
                );
            },
            removeAnalysisRow: (analysisId) => {
                const hot = hotTableRef.current?.hotInstance;
                const rowIndex = findAnalysisRowIndex(analysisId);
                if (!hot || rowIndex < 0) return;
                hot.alter('remove_row', rowIndex, 1, STUDY_ANNOTATIONS_SYNC_SOURCE);

                // rows below the removed row move up by one
                const pendingEdits = pendingEditsRef.current;
                pendingEdits.dirtyRowIndexes = new Set(
                    [...pendingEdits.dirtyRowIndexes]
                        .filter((dirtyRowIndex) => dirtyRowIndex !== rowIndex)
                        .map((dirtyRowIndex) => (dirtyRowIndex > rowIndex ? dirtyRowIndex - 1 : dirtyRowIndex))
                );
            },
            updateAnalysisDetails: (analysisId, field, value) => {
                const hot = hotTableRef.current?.hotInstance;
                const rowIndex = findAnalysisRowIndex(analysisId);
                if (!hot || rowIndex < 0) return;
                hot.setDataAtRowProp(
                    rowIndex,
                    field === 'name' ? 'analysis_name' : 'analysisDescription',
                    value,
                    STUDY_ANNOTATIONS_SYNC_SOURCE
                );
            },
        };

        return () => {
            studyAnnotationsTableRef.current = null;
        };
    }, [snapshot, studyAnnotationsTableRef]);

    const handleAddHotColumn = (row: IMetadataRowModel) => {
        const pendingEdits = pendingEditsRef.current;
        const trimmedKey = row.metadataKey.trim();
        if (pendingEdits.noteKeys.find((x) => x.key === trimmedKey)) return false;

        const columnType = getType(row.metadataValue);
        const defaultValue = getDefaultForNoteKey(trimmedKey, columnType);

        const updatedNoteKeys: NoteKeyType[] = [
            {
                key: trimmedKey,
                type: columnType,
                order: 0,
                default: defaultValue,
            },
            ...pendingEdits.noteKeys,
        ].map((noteKey, index) => ({ ...noteKey, order: index }));

        const hot = hotTableRef.current?.hotInstance;
        if (hot) {
            hot.updateSettings(createStudyAnnotationColumnSettings(updatedNoteKeys, readonly));
            hot.setDataAtRowProp(
                Array.from({ length: hot.countRows() }, (_, rowIndex) => [
                    rowIndex,
                    `note.${trimmedKey}`,
                    defaultValue,
                ]),
                STUDY_ANNOTATIONS_SYNC_SOURCE
            );
        }
        pendingEdits.noteKeys = updatedNoteKeys;
        pendingEdits.noteKeysHaveChanged = true;
        setAnnotationHasEdits(true);

        return true;
    };

    const handleConfirmationDialogClose = (confirm: boolean | undefined) => {
        if (confirm) {
            const pendingEdits = pendingEditsRef.current;
            const updatedNoteKeys = pendingEdits.noteKeys
                .filter((noteKey) => noteKey.key !== confirmationDialogState.colKey)
                .map((noteKey, index) => ({ ...noteKey, order: index }));

            hotTableRef.current?.hotInstance?.updateSettings(
                createStudyAnnotationColumnSettings(updatedNoteKeys, readonly)
            );
            pendingEdits.noteKeys = updatedNoteKeys;
            pendingEdits.noteKeysHaveChanged = true;
            setAnnotationHasEdits(true);
        }
        setConfirmationDialogState({
            isOpen: false,
            colKey: '',
        });
    };

    // stable so that the memoized table does not re-render
    const handleRemoveColumnClick = useCallback((colKey: string) => {
        setConfirmationDialogState({
            isOpen: true,
            colKey,
        });
    }, []);

    return (
        <Box>
            {canEdit && !readonly && (
                <Box
                    sx={{
                        mb: 3,
                        width: {
                            xs: '100%',
                            md: '80%',
                            lg: '70%',
                        },
                        display: 'grid',
                        gridTemplateColumns: 'auto 1fr auto',
                        gap: 4,
                    }}
                >
                    <AddMetadataRow
                        keyPlaceholderText="New Column"
                        onAddMetadataRow={handleAddHotColumn}
                        defaultType={EPropertyType.BOOLEAN}
                        showMetadataValueInput={false}
                        allowNone={false}
                        errorMessage="can't add column (key already exists)"
                    />
                </Box>
            )}
            <Box sx={{ width: '100%', height: '100%' }}>
                <ConfirmationDialog
                    isOpen={confirmationDialogState.isOpen}
                    onCloseDialog={handleConfirmationDialogClose}
                    dialogTitle="Are you sure you want to remove this column?"
                    dialogMessage={`This will remove annotation data in all other studies for ${confirmationDialogState.colKey}`}
                    confirmText="Remove"
                    rejectText="Cancel"
                />
                {snapshot && (
                    <EditStudyAnnotationsHotTable
                        key={snapshot.annotationId}
                        initialState={snapshot}
                        hotTableRef={hotTableRef}
                        pendingEditsRef={pendingEditsRef}
                        onHasEdits={setAnnotationHasEdits}
                        onRemoveColumnClick={handleRemoveColumnClick}
                    />
                )}
            </Box>
        </Box>
    );
};

export default EditStudyAnnotationsContainer;

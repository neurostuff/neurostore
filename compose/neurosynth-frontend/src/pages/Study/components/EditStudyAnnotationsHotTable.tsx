import { HotTable } from '@handsontable/react';
import { Box } from '@mui/material';
import ConfirmationDialog from 'components/Dialogs/ConfirmationDialog';
import AddMetadataRow from 'components/EditMetadata/AddMetadataRow';
import { getType, IMetadataRowModel } from 'components/EditMetadata/EditMetadata.types';
import { sanitizePaste } from 'components/HotTables/HotTables.utils';
import CellCoords from 'handsontable/3rdparty/walkontable/src/cell/coords';
import { CellChange } from 'handsontable/common';
import { useUserCanEdit } from 'hooks';
import { useProjectUser } from 'pages/Project/store/ProjectStore';
import { HotSettings } from 'pages/Study/components/EditStudyAnnotationsHotTable.helpers';
import useEditStudyAnnotationsHotTable from 'pages/Study/hooks/useEditStudyAnnotationsHotTable';
import { useMemo, useRef, useState } from 'react';
import {
    useAnnotationNoteKeys,
    useCreateAnnotationColumn,
    useRemoveAnnotationColumn,
    useReorderAnnotationColumns,
    useUpdateAnnotationNotes,
} from 'stores/AnnotationStore.actions';

const EditStudyAnnotationsHotTable: React.FC<{ readonly?: boolean }> = ({ readonly = false }) => {
    const hotTableRef = useRef<HotTable>(null);
    const noteKeys = useAnnotationNoteKeys();
    const updateNotes = useUpdateAnnotationNotes();
    const createAnnotationColumn = useCreateAnnotationColumn();
    const removeAnnotationColumn = useRemoveAnnotationColumn();
    const reorderAnnotationColumns = useReorderAnnotationColumns();
    const { colWidths, colHeaders, columns, hiddenRows, data } = useEditStudyAnnotationsHotTable(readonly);
    const projectUser = useProjectUser();
    const canEdit = useUserCanEdit(projectUser || undefined);
    const [confirmationDialogState, setConfirmationDialogState] = useState({
        isOpen: false,
        colKey: '',
    });

    const handleAfterChange = (changes: CellChange[] | null) => {
        if (!data || !noteKeys || !changes) return;

        const updatedNotes = [...data];
        changes.forEach((change) => {
            if (!change) return;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const [row, colName, _prev, next] = change;
            let newVal = next;
            if (newVal === null || newVal === '') {
                newVal = undefined;
            }
            updatedNotes[row] = {
                ...updatedNotes[row],
                note: {
                    ...updatedNotes[row].note,
                    [(colName as string).split('.')[1]]: newVal, // col names are given to us in the form "note.key"
                },
            };
            delete updatedNotes[row].analysisDescription;
        });
        updateNotes(updatedNotes);
    };

    const handleBeforePaste = (pastedData: unknown[][]) => {
        if (!data) return false;
        sanitizePaste(pastedData);
        return true;
    };

    const handleAddHotColumn = (row: IMetadataRowModel) => {
        if (!noteKeys) return false;
        const trimmedKey = row.metadataKey.trim();
        if (noteKeys.find((x) => x.key === trimmedKey)) return false;

        createAnnotationColumn({
            key: trimmedKey,
            type: getType(row.metadataValue),
        });

        return true;
    };

    const handleConfirmationDialogClose = (confirm: boolean | undefined) => {
        if (confirm) {
            removeAnnotationColumn(confirmationDialogState.colKey);
        }
        setConfirmationDialogState({
            isOpen: false,
            colKey: '',
        });
    };

    const handleCellMouseUp = (event: MouseEvent, coords: CellCoords, TD: HTMLTableCellElement) => {
        const target = event.target as HTMLButtonElement;
        if (coords.row < 0) {
            const removeTarget = (target as HTMLElement).closest('[data-remove-col="true"]');
            if (removeTarget) {
                const colKey = (target as HTMLElement).closest('[data-col-key]')?.getAttribute('data-col-key');
                if (!colKey) return;
                setConfirmationDialogState({
                    isOpen: true,
                    colKey: colKey,
                });
            }
        }
    };

    const handleColumnMove = (movedColumns: number[], finalIndex: number) => {
        if (readonly || !canEdit) return;
        if (!movedColumns.length) return;

        const fromVisualIndex = movedColumns[0];
        const toVisualIndex = finalIndex;

        // first two columns are static (analysis name/description)
        if (fromVisualIndex < 2 || toVisualIndex < 2) return;

        const from = fromVisualIndex - 2;
        let to = toVisualIndex - 2;

        if (!noteKeys) return;
        if (to >= noteKeys.length) to = noteKeys.length - 1;

        reorderAnnotationColumns(from, to);
        hotTableRef.current?.hotInstance?.getPlugin('manualColumnMove').clearMoves();
    };

    const handleBeforeOnCellMouseDown = (event: MouseEvent, coords: CellCoords) => {
        if (coords.row < 0) {
            const target = event.target as HTMLElement;
            const isDragHandle = target?.closest('[data-drag-handle="true"]');
            if (isDragHandle) {
                // allow drag to proceed; prevent default selection highlighting
                event.preventDefault();
            }
        }
    };

    const memoizedData = useMemo(() => {
        return JSON.parse(JSON.stringify(data || []));
    }, [data]);

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
                <HotTable
                    {...HotSettings}
                    afterChange={handleAfterChange}
                    beforePaste={handleBeforePaste}
                    width="100%"
                    height="auto"
                    stretchH="all"
                    hiddenRows={{
                        rows: hiddenRows,
                        indicators: false,
                    }}
                    afterOnCellMouseUp={handleCellMouseUp}
                    beforeOnCellMouseDown={handleBeforeOnCellMouseDown}
                    manualColumnMove={!readonly && canEdit}
                    afterColumnMove={handleColumnMove}
                    colWidths={colWidths}
                    columns={columns}
                    colHeaders={colHeaders}
                    data={memoizedData}
                    ref={hotTableRef}
                />
            </Box>
        </Box>
    );
};

export default EditStudyAnnotationsHotTable;

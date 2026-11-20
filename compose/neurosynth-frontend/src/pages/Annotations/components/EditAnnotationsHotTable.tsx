import { HotTable, HotTableRef } from '@handsontable/react-wrapper';
import { AnnotationNoteValue, NoteKeyType } from 'components/HotTables/HotTables.types';
import { CellChange, CellCoords } from 'handsontable';
import { registerAllModules } from 'handsontable/registry';
import { EditAnnotationsHotSnapshot } from 'pages/Annotations/hooks/useEditAnnotationsHotTable';
import React, { useRef } from 'react';
import { hotSettings, isRemoveColumnButton, moveNoteKeys, reloadNoteColumns } from './EditAnnotationsHotTable.helpers';

registerAllModules();

/** Bookkeeping needed to pick between the PUT /annotations and POST /annotation-analyses save paths. */
export type PendingAnnotationEdits = {
    noteKeys: NoteKeyType[];
    dirtyRowIndexes: Set<number>;
    noteKeysHaveChanged: boolean;
};

/**
 * The react wrapper calls updateSettings (including data) on every render, so this component must not re-render
 * after mount: every prop is stable and handlers only read refs.
 */
const EditAnnotationsHotTable = React.memo(
    (props: {
        initialState: EditAnnotationsHotSnapshot;
        hotTableRef: React.RefObject<HotTableRef | null>;
        canEditRef: React.RefObject<boolean>;
        pendingEditsRef: React.RefObject<PendingAnnotationEdits>;
        onHasEdits: (hasEdits: boolean) => void;
    }) => {
        const { initialState: snapshot, hotTableRef, canEditRef, pendingEditsRef, onHasEdits } = props;
        const deleteButtonPressedColumnRef = useRef<number | null>(null);

        const handleRemoveHotColumn = (colKey: string) => {
            const hot = hotTableRef.current?.hotInstance;
            if (!canEditRef.current || !hot) return;
            const pendingEdits = pendingEditsRef.current;
            const foundIndex = pendingEdits.noteKeys.findIndex((x) => x.key === colKey && x.key !== 'included');
            if (foundIndex < 0) return;

            const updatedNoteKeys = pendingEdits.noteKeys
                .filter((_, index) => index !== foundIndex)
                .map((noteKey, index) => ({ ...noteKey, order: index }));
            const updatedHotData = (hot.getData() as AnnotationNoteValue[][]).map((row) =>
                row.filter((_, col) => col !== foundIndex + 2)
            );

            reloadNoteColumns(hot, updatedHotData, updatedNoteKeys);
            pendingEdits.noteKeys = updatedNoteKeys;
            pendingEdits.noteKeysHaveChanged = true;
            onHasEdits(true);
        };

        /**
         * This handler
         * 1) prevents the first two columns from being selected or dragged
         * 2) records which column's remove button the press started on, if any
         */
        const handleCellMouseDown = (event: MouseEvent, coords: CellCoords): void => {
            const isColumnHeader = coords.row != null && coords.row < 0;
            const isDeleteButton = isRemoveColumnButton(event.target);
            // A column is only removed when the press and the release both land on its remove button, so column moves
            // and multi-cell selections that end on a remove button do not remove it
            deleteButtonPressedColumnRef.current = isColumnHeader && isDeleteButton ? coords.col : null;

            // the study name and analysis name columns cannot be selected or dragged
            const isStudyOrAnalysisColumn = coords.col != null && coords.col < 2;
            if (isStudyOrAnalysisColumn) {
                event.stopImmediatePropagation();
                return;
            }
        };

        /**
         * This handler checks if the press and release both land on the same column's remove button.
         * If so, it removes the column.
         */
        const handleCellMouseUp = (event: MouseEvent, coords: CellCoords, TD: HTMLTableCellElement): void => {
            const deleteButtonPressedColumn = deleteButtonPressedColumnRef.current;
            deleteButtonPressedColumnRef.current = null;

            const isColumnHeader = coords.row != null && coords.row < 0;
            const isDeleteButton = isRemoveColumnButton(event.target);
            if (isColumnHeader && isDeleteButton && coords.col === deleteButtonPressedColumn) {
                handleRemoveHotColumn(TD.innerText);
            }
        };

        const handleBeforeColumnMove = (movedColumns: number[], finalIndex: number) => {
            if (!canEditRef.current) return false;

            // Prevent moving locked columns (first two columns are study name and analysis name)
            if (movedColumns.some((col) => col < 2) || finalIndex < 2) return false;

            return true;
        };

        const handleAfterColumnMove = (
            movedColumns: number[],
            finalIndex: number,
            _dropIndex: number | undefined,
            _movePossible: boolean,
            orderChanged: boolean
        ) => {
            if (!orderChanged) return;
            const pendingEdits = pendingEditsRef.current;
            // subtract 2 for the study name and analysis name columns
            pendingEdits.noteKeys = moveNoteKeys(
                pendingEdits.noteKeys,
                movedColumns.map((col) => col - 2),
                finalIndex - 2
            );
            pendingEdits.noteKeysHaveChanged = true;
            onHasEdits(true);
        };

        /**
         * On top of being triggered when a change occurs, this hook is also triggered during initial mergeCells and on initial update.
         * CellChange is represented by [row, column, prevValue, nextValue]
         */
        const handleAfterChange = (changes: CellChange[] | null) => {
            if (!changes) return;
            const isDoingMergeCellOperation = changes.some((x) => x[1] === 0);
            if (isDoingMergeCellOperation) return; // We don't want update to occur when handsontable is merging cells, only when a user update occurs

            changes.forEach(([row]) => pendingEditsRef.current.dirtyRowIndexes.add(row));
            onHasEdits(true);
        };

        return (
            <HotTable
                {...hotSettings}
                ref={hotTableRef}
                readOnly={!canEditRef.current}
                manualColumnMove={canEditRef.current}
                disableVisualSelection={!canEditRef.current}
                data={snapshot.hotData}
                mergeCells={snapshot.mergeCells}
                colHeaders={snapshot.hotColumnHeaders}
                colWidths={snapshot.colWidths}
                rowHeights={snapshot.rowHeights}
                columns={snapshot.hotColumns}
                afterChange={handleAfterChange}
                afterOnCellMouseUp={handleCellMouseUp}
                beforeOnCellMouseDown={handleCellMouseDown}
                beforeColumnMove={handleBeforeColumnMove}
                afterColumnMove={handleAfterColumnMove}
            />
        );
    }
);

export default EditAnnotationsHotTable;

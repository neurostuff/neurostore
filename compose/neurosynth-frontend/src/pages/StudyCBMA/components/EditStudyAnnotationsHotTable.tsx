import { HotTable, HotTableRef } from '@handsontable/react-wrapper';
import { sanitizePaste } from 'components/HotTables/HotTables.utils';
import { CellChange, CellCoords, ChangeSource } from 'handsontable';
import { PendingAnnotationEdits } from 'pages/Annotations/components/EditAnnotationsHotTable';
import { isRemoveColumnButton } from 'pages/Annotations/components/EditAnnotationsHotTable.helpers';
import {
    HotSettings,
    STUDY_ANNOTATIONS_SYNC_SOURCE,
} from 'pages/StudyCBMA/components/EditStudyAnnotationsHotTable.helpers';
import { EditStudyAnnotationsHotSnapshot } from 'pages/StudyCBMA/hooks/useEditStudyAnnotationsHotTable';
import React from 'react';

/**
 * The react wrapper calls updateSettings (including data) on every render, so this component must not re-render
 * after mount: every prop is stable and handlers only read refs.
 */
const EditStudyAnnotationsHotTable = React.memo(
    (props: {
        initialState: EditStudyAnnotationsHotSnapshot;
        hotTableRef: React.RefObject<HotTableRef | null>;
        pendingEditsRef: React.RefObject<PendingAnnotationEdits>;
        onHasEdits: (hasEdits: boolean) => void;
        onRemoveColumnClick: (colKey: string) => void;
    }) => {
        const { initialState: snapshot, hotTableRef, pendingEditsRef, onHasEdits, onRemoveColumnClick } = props;

        const handleAfterChange = (changes: CellChange[] | null, source: ChangeSource) => {
            if (!changes || (source as string) === STUDY_ANNOTATIONS_SYNC_SOURCE) return;

            changes.forEach(([row]) => pendingEditsRef.current.dirtyRowIndexes.add(row));
            onHasEdits(true);
        };

        const handleBeforePaste = (pastedData: unknown[][]) => {
            sanitizePaste(pastedData);
            return true;
        };

        const handleCellMouseUp = (event: MouseEvent, coords: CellCoords, TD: HTMLTableCellElement) => {
            if (coords.row != null && coords.row < 0 && isRemoveColumnButton(event.target)) {
                onRemoveColumnClick(TD.innerText);
            }
        };

        return (
            <HotTable
                {...HotSettings}
                ref={hotTableRef}
                afterChange={handleAfterChange}
                beforePaste={handleBeforePaste}
                width="100%"
                height="auto"
                stretchH="all"
                hiddenRows={{
                    rows: snapshot.hiddenRows,
                    indicators: false,
                }}
                afterOnCellMouseUp={handleCellMouseUp}
                colWidths={snapshot.colWidths}
                columns={snapshot.columns}
                colHeaders={snapshot.colHeaders}
                data={snapshot.hotData}
            />
        );
    }
);

export default EditStudyAnnotationsHotTable;

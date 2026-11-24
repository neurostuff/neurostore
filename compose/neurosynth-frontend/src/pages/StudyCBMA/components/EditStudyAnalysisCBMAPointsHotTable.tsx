import { HotTable, HotTableRef } from '@handsontable/react-wrapper';
import { alpha, Box } from '@mui/material';
import { sanitizePaste } from 'components/HotTables/HotTables.utils';
import { CellChange, ChangeSource } from 'handsontable';
import { registerAllModules } from 'handsontable/registry';
import { EditAnalysisPointsHotSnapshot } from 'pages/StudyCBMA/hooks/useEditAnalysisPointsHotTable';
import { memo, useEffect, useRef, type RefObject } from 'react';
import { useSetAnalysisPointWarnings } from 'stores/study/StudyStore';
import { allPointsHaveCoordinates, getPointWarnings, PointWarnings } from 'stores/study/StudyStore.helpers';
import { v4 as uuid } from 'uuid';
import {
    EditStudyAnalysisCBMAPointsDefaultConfig,
    getHotTableColumnSettings,
    getSelectionRowBounds,
    hotTableColHeaders,
    multiRowInsertLabel,
    POINTS_SYNC_SOURCE,
    pointsFromSourceData,
    pointsTableHeight,
} from './EditStudyAnalysisCBMAPointsHotTable.helpers';

registerAllModules();

/** New rows are born blank. Mark X/Y/Z invalid immediately so the warning fill shows before the next edit. */
const validateInsertedCoordinateCells = (
    hot: NonNullable<HotTableRef['hotInstance']>,
    insertionIndex: number,
    amount: number
) => {
    const xCol = hot.propToCol('x');
    const yCol = hot.propToCol('y');
    const zCol = hot.propToCol('z');
    if (typeof xCol !== 'number' || typeof yCol !== 'number' || typeof zCol !== 'number') return;

    for (let offset = 0; offset < amount; offset += 1) {
        const row = insertionIndex + offset;
        hot.validateCell(hot.getDataAtCell(row, xCol), hot.getCellMeta(row, xCol), () => undefined, 'validateCells');
        hot.validateCell(hot.getDataAtCell(row, yCol), hot.getCellMeta(row, yCol), () => undefined, 'validateCells');
        hot.validateCell(hot.getDataAtCell(row, zCol), hot.getCellMeta(row, zCol), () => undefined, 'validateCells');
    }
};

/**
 * Every prop here stays stable and handlers only read refs.
 */
const EditStudyAnalysisCBMAPointsHotTable = memo(function EditStudyAnalysisCBMAPointsHotTable({
    snapshot,
    hotTableRef,
    onStudyEdited,
    onAllPointsHaveCoordinates,
    readOnly,
}: {
    snapshot: EditAnalysisPointsHotSnapshot;
    hotTableRef: RefObject<HotTableRef | null>;
    onStudyEdited: () => void;
    onAllPointsHaveCoordinates: (pointsHaveCoordinates: boolean) => void;
    readOnly: boolean;
}) {
    const setAnalysisPointWarnings = useSetAnalysisPointWarnings();
    const containerRef = useRef<HTMLDivElement>(null);
    const pointWarningsRef = useRef(snapshot.pointWarnings);
    const allPointsHaveCoordinatesRef = useRef(allPointsHaveCoordinates(snapshot.points));
    const hasMarkedEditedRef = useRef(false);

    const markEdited = () => {
        if (hasMarkedEditedRef.current) return;
        hasMarkedEditedRef.current = true;
        onStudyEdited();
    };

    const updatePointWarnings = (changed: Partial<PointWarnings>) => {
        const prev = pointWarningsRef.current;
        const next = { ...prev, ...changed };
        if ((Object.keys(next) as (keyof PointWarnings)[]).every((key) => next[key] === prev[key])) return;
        pointWarningsRef.current = next;
        setAnalysisPointWarnings(snapshot.analysisId, next);
    };

    const updateFromSourceData = (hot: NonNullable<HotTableRef['hotInstance']>) => {
        const points = pointsFromSourceData(hot.getSourceData());
        updatePointWarnings(getPointWarnings(points));

        const coordinatesAreComplete = allPointsHaveCoordinates(points);
        if (coordinatesAreComplete === allPointsHaveCoordinatesRef.current) return;
        allPointsHaveCoordinatesRef.current = coordinatesAreComplete;
        onAllPointsHaveCoordinates(coordinatesAreComplete); // this is to hide/show the relegate link in the parent
    };

    const setTableHeight = (rowCount: number) => {
        const height = pointsTableHeight(rowCount);
        if (containerRef.current) containerRef.current.style.height = `${height}px`;
        hotTableRef.current?.hotInstance?.updateSettings({ height });
    };

    const handleAfterChange = (changes: CellChange[] | null, source: ChangeSource) => {
        if (!changes || (source as string) === POINTS_SYNC_SOURCE || source === 'loadData' || source === 'updateData') {
            return;
        }
        const hot = hotTableRef.current?.hotInstance;
        if (!hot) return;

        markEdited();
        updateFromSourceData(hot);
        // afterAutofill runs before the fill is written, so validation there restamps the previous invalid state.
        if ((source as string) === 'autofill.fill' || (source as string) === 'Autofill.fill') {
            const rows = [...new Set(changes.map(([row]) => row))];
            hot.validateRows(rows);
        }
    };

    const handleBeforePaste = (data: unknown[][]) => {
        sanitizePaste(data);
        return true;
    };

    const handleAfterCreateRow = (insertionIndex: number, amount: number) => {
        const hot = hotTableRef.current?.hotInstance;
        if (!hot) return;

        // changes: [ [ rowIndex, columnKey, value ] ] ... At this point, insertion has already occurred, we want to set values
        const changes: [number, string, string | boolean][] = [];
        for (let offset = 0; offset < amount; offset += 1) {
            changes.push([insertionIndex + offset, 'id', uuid()], [insertionIndex + offset, 'isNew', true]);
        }
        hot.setDataAtRowProp(changes, POINTS_SYNC_SOURCE);
        validateInsertedCoordinateCells(hot, insertionIndex, amount);

        setTableHeight(hot.countRows());
        markEdited();
        updateFromSourceData(hot);
    };

    const handleAfterRemoveRow = () => {
        const hot = hotTableRef.current?.hotInstance;
        if (!hot) return;

        if (hot.countRows() === 0) {
            // Deleting every row still leaves one blank coordinate row.
            hot.alter('insert_row_above', 0, 1);
            return;
        }

        setTableHeight(hot.countRows());
        markEdited();
        updateFromSourceData(hot);
    };

    const selectedRowBounds = () => getSelectionRowBounds(hotTableRef.current?.hotInstance?.getSelected() ?? []);

    const insertSelectedRowCount = (placement: 'above' | 'below') => {
        const hot = hotTableRef.current?.hotInstance;
        const bounds = getSelectionRowBounds(hot?.getSelected() ?? []);
        if (!hot || !bounds || bounds.count < 2) return;

        if (placement === 'above') {
            hot.alter('insert_row_above', bounds.top, bounds.count);
            return;
        }
        hot.alter('insert_row_below', bounds.bottom, bounds.count);
    };

    useEffect(() => {
        hotTableRef.current?.hotInstance?.validateCells();
    }, [hotTableRef]);

    // once the table unmounts, its rows are flushed or discarded, so warnings come from the stored points again
    useEffect(() => {
        const { analysisId } = snapshot;
        setAnalysisPointWarnings(analysisId, pointWarningsRef.current);
        return () => setAnalysisPointWarnings(analysisId);
    }, [snapshot, setAnalysisPointWarnings]);

    return (
        <Box
            ref={containerRef}
            sx={(theme) => ({
                width: '100%',
                height: snapshot.height,
                '& .ht-theme-classic': {
                    '--ht-cell-error-background-color': alpha(theme.palette.warning.main, 0.45),
                },
                // number/boolean cell classes set their own color with !important.
                '& .handsontable td.htInvalid': {
                    color: `${theme.palette.error.main} !important`,
                },
            })}
        >
            <HotTable
                {...EditStudyAnalysisCBMAPointsDefaultConfig}
                ref={hotTableRef}
                afterChange={handleAfterChange}
                beforePaste={handleBeforePaste}
                afterCreateRow={handleAfterCreateRow}
                afterRemoveRow={handleAfterRemoveRow}
                contextMenu={{
                    items: {
                        // Built-in items insert one row at the selection edge.
                        row_above: {
                            name: 'Add row above',
                        },
                        rows_above: {
                            name: () => multiRowInsertLabel(selectedRowBounds()?.count ?? 0, 'above'),
                            hidden: () => (selectedRowBounds()?.count ?? 0) < 2,
                            callback: () => insertSelectedRowCount('above'),
                        },
                        row_below: {
                            name: 'Add row below',
                        },
                        rows_below: {
                            name: () => multiRowInsertLabel(selectedRowBounds()?.count ?? 0, 'below'),
                            hidden: () => (selectedRowBounds()?.count ?? 0) < 2,
                            callback: () => insertSelectedRowCount('below'),
                        },
                        remove_row: {
                            name: 'Remove row(s)',
                        },
                        copy: {
                            name: 'Copy',
                        },
                        cut: {
                            name: 'Cut',
                        },
                    },
                }}
                height={snapshot.height}
                stretchH="all"
                columns={getHotTableColumnSettings(readOnly)}
                colHeaders={hotTableColHeaders}
                data={snapshot.points}
            />
        </Box>
    );
});

export default EditStudyAnalysisCBMAPointsHotTable;

import { CoordinateTable, type CoordinateTableHandle, type GridEngagement } from '@neurosynth/coordinate-table';
import { Typography } from '@mui/material';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CoordinateAnalysis } from '../model/coordinates';
import { useIsEditable, useReviewStores, useSession } from '../store/context';
import { selectShownPoints } from '../store/sessionStore';
import { pairProblems, pointColumns, toPoints, toRows } from './pointRows';

type Row = Record<string, unknown>;

const rowsBetween = (first: number, last: number) =>
    Array.from({ length: Math.max(last - first + 1, 0) }, (_, i) => first + i);

/**
 * The points of `analysis` in a spreadsheet, as the reviewer last left them; each committed change is collected, and
 * the grid takes edits while earlier ones save. A refusal brings back the analysis's points. It carries on what the
 * reviewer began on the static table, and commits the edit still open once hidden, sending it at once. A selection
 * over rows selects those points, as Space does; hidden, a selection in it focuses and selects nothing.
 */
export default function PointsTable({
    analysis,
    allColumns,
    engagement,
}: {
    analysis: CoordinateAnalysis;
    allColumns: boolean;
    /** What the reviewer began on the static table; null while the grid is hidden. */
    engagement: GridEngagement | null;
}) {
    const stores = useReviewStores();
    const editable = useIsEditable();
    const points = useSession((s) => selectShownPoints(s, analysis.key));
    const grid = useRef<CoordinateTableHandle>(null);
    const [problems, setProblems] = useState<string[]>([]);
    const rows = useMemo(() => toRows(points), [points]);
    const columns = useMemo(
        () => pointColumns(analysis.coordinate_space, allColumns),
        [analysis.coordinate_space, allColumns]
    );

    /** Whether the points selected came from a selection over rows here, which a selection of one row clears. */
    const spanned = useRef(false);
    const settled = useRef(false);
    useEffect(() => {
        queueMicrotask(() => (settled.current = true));
        return () => {
            settled.current = false;
        };
    }, []);
    // The first engagement waits for the mount to settle, so that a grid mounted twice, as under StrictMode, is engaged once.
    useEffect(() => {
        if (!engagement) return;
        if (settled.current) return void grid.current?.engage(engagement);
        let dropped = false;
        queueMicrotask(() => {
            if (!dropped) grid.current?.engage(engagement);
        });
        return () => {
            dropped = true;
        };
    }, [engagement]);
    const active = engagement !== null;
    const hidden = useRef(!active);
    useLayoutEffect(() => {
        hidden.current = !active;
        if (!active) grid.current?.finish();
    }, [active]);

    const onChange = (next: Row[]) => {
        const found = pairProblems(next);
        setProblems(found);
        if (found.length > 0) return;
        const { collect, askToSend } = stores.session.getState();
        if (collect(analysis.key, toPoints(next)) && hidden.current) askToSend();
    };

    return (
        <>
            <CoordinateTable
                ref={grid}
                label={`edit the points of ${analysis.name}`}
                points={rows}
                columns={columns}
                readOnly={!editable}
                onChange={onChange}
                onSelectRow={({ row, first, last }) => {
                    if (!active) return;
                    const count = analysis.points?.length ?? 0;
                    const { coordinates, focusAnalysis, selectPoints } = stores.view.getState();
                    if (row < count && coordinates?.point !== row) focusAnalysis(analysis.key, row);
                    if (first !== last) {
                        spanned.current = true;
                        selectPoints(rowsBetween(first, Math.min(last, count - 1)));
                    } else if (spanned.current) {
                        spanned.current = false;
                        selectPoints([]);
                    }
                }}
            />
            {problems.map((problem) => (
                <Typography key={problem} variant="caption" color="error" component="div">
                    {problem}
                </Typography>
            ))}
        </>
    );
}

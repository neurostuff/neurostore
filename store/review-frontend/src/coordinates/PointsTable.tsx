import { CoordinateTable, type CoordinateTableHandle, type GridEngagement } from '@neurosynth/coordinate-table';
import { Typography } from '@mui/material';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CoordinateAnalysis } from '../model/coordinates';
import { useIsEditable, useReviewStores, useSession } from '../store/context';
import { savePoints } from './actions';
import { coordinatePending, pendingKeys } from './availability';
import { pairProblems, pointColumns, toPoints, toRows } from './pointRows';

type Row = Record<string, unknown>;

const rowsBetween = (first: number, last: number) =>
    Array.from({ length: Math.max(last - first + 1, 0) }, (_, i) => first + i);

/**
 * The points of `analysis` in a spreadsheet; each committed change is one edit_points op. While it is unconfirmed
 * the grid shows what was sent and takes no edits; a refusal brings back the analysis's points. It carries on what
 * the reviewer began on the static table, and commits the edit still open once hidden. A selection over rows selects
 * those points, as Space does; hidden, a selection in it focuses and selects nothing.
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
    const saving = useSession((s) => pendingKeys(s).has(analysis.key));
    const pending = useSession(coordinatePending);
    const grid = useRef<CoordinateTableHandle>(null);
    const [sent, setSent] = useState<{ key: string; rows: Row[] } | null>(null);
    const [problems, setProblems] = useState<string[]>([]);
    const rows = useMemo(() => toRows(analysis.points ?? []), [analysis.points]);
    const columns = useMemo(
        () => pointColumns(analysis.coordinate_space, allColumns),
        [analysis.coordinate_space, allColumns]
    );
    const shown = saving && sent?.key === analysis.key ? sent.rows : rows;

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
    useLayoutEffect(() => {
        if (!active) grid.current?.finish();
    }, [active]);

    const onChange = (next: Row[]) => {
        const found = pairProblems(next);
        setProblems(found);
        if (found.length === 0 && savePoints(stores, analysis.key, toPoints(next))) {
            setSent({ key: analysis.key, rows: next });
        }
    };

    return (
        <>
            <CoordinateTable
                ref={grid}
                label={`edit the points of ${analysis.name}`}
                points={shown}
                columns={columns}
                readOnly={!editable || pending}
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

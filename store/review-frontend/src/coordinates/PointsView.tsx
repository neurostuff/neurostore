import { StaticTable, type GridEngagement } from '@neurosynth/coordinate-table/static';
import { Box, Button } from '@mui/material';
import { lazy, Suspense, useMemo, useState } from 'react';
import type { CoordinateAnalysis } from '../model/coordinates';
import { useIsEditable, useReviewStores, useSession, useView } from '../store/context';
import { coordinatePending } from './availability';
import { pointColumns, toRows } from './pointRows';

// The grid and Handsontable are a chunk of their own, fetched as soon as the review loads, since Coordinates is its first step.
const pointsTable = import('./PointsTable');
const LazyPointsTable = lazy(() => pointsTable);
/**
 * The grid's component once its chunk is in, rendered as is: lazy() suspends on its first render even then, and a
 * key typed while the table waits for the grid would land on nothing.
 */
let loaded: (typeof import('./PointsTable'))['default'] | null = null;
void pointsTable.then((module) => (loaded = module.default));

/**
 * The focused analysis's points: a read-only table until the reviewer begins to edit, then the point grid, which
 * carries on what they began. The grid, once mounted, stays mounted, hidden while another analysis's table shows.
 */
export function PointsView({ analysis }: { analysis: CoordinateAnalysis }) {
    const request = useView((s) => s.gridEngagement);
    const stores = useReviewStores();
    const engageGrid = useView((s) => s.engageGrid);
    const point = useView((s) => s.coordinates?.point ?? null);
    const editable = useIsEditable();
    const pending = useSession(coordinatePending);
    const [allColumns, setAllColumns] = useState(false);
    const [held, setHeld] = useState<CoordinateAnalysis | null>(null);
    const [begun, setBegun] = useState<{ engagement: GridEngagement; request: number } | null>(null);
    const engaged = request !== null;
    if (engaged && held !== analysis) setHeld(analysis);
    const engagement = useMemo(
        () =>
            request === null
                ? null
                : begun?.request === request
                  ? begun.engagement
                  : { kind: 'select' as const, row: stores.view.getState().coordinates?.point ?? 0, column: 0 },
        [request, begun, stores]
    );
    const onEngage = (next: GridEngagement) => {
        setBegun({ engagement: next, request: (request ?? 0) + 1 });
        engageGrid();
    };
    const rows = useMemo(() => toRows(analysis.points ?? []), [analysis.points]);
    const columns = useMemo(
        () => pointColumns(analysis.coordinate_space, allColumns),
        [analysis.coordinate_space, allColumns]
    );
    const table = (
        <StaticTable
            rows={rows}
            columns={columns}
            caption={`points of ${analysis.name}`}
            row={point}
            readOnly={!editable || pending}
            onEngage={onEngage}
        />
    );
    const gridAnalysis = engaged ? analysis : held;
    const PointsTable = loaded ?? LazyPointsTable;
    return (
        <>
            {gridAnalysis && (
                <Box sx={engaged ? undefined : { display: 'none' }}>
                    <Suspense fallback={engaged ? table : null}>
                        <PointsTable analysis={gridAnalysis} allColumns={allColumns} engagement={engagement} />
                    </Suspense>
                </Box>
            )}
            {!engaged && table}
            <Button size="small" aria-pressed={allColumns} onClick={() => setAllColumns((shown) => !shown)}>
                More columns
            </Button>
        </>
    );
}

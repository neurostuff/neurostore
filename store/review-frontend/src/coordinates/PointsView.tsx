import { dropHeldKeys, StaticTable, type GridEngagement } from '@neurosynth/coordinate-table/static';
import { Box, Button, Typography } from '@mui/material';
import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CoordinateAnalysis } from '../model/coordinates';
import { useIsEditable, useReviewStores, useSession, useView } from '../store/context';
import { selectShownPoints } from '../store/sessionStore';
import { pointColumns, toRows } from './pointRows';
import { Hint } from '../review/Hint';

// The grid and Handsontable are a chunk of their own, fetched as soon as the review loads, since Coordinates is its first step.
const pointsTable = import('./PointsTable').catch(() => ({ default: GridUnavailable }));
const LazyPointsTable = lazy(() => pointsTable);
/**
 * The grid's component once its chunk is in, rendered as is: lazy() suspends on its first render even then, and a
 * key typed while the table waits for the grid would land on nothing.
 */
let loaded: (typeof import('./PointsTable'))['default'] | null = null;
void pointsTable.then((module) => (loaded = module.default));

/**
 * The focused analysis's points: a read-only table until the reviewer begins to edit, then the point grid, which
 * carries on what they began, then `children`. The grid, once mounted, stays mounted, hidden while another
 * analysis's table shows.
 */
export function PointsView({ analysis, children }: { analysis: CoordinateAnalysis; children?: ReactNode }) {
    const request = useView((s) => s.gridEngagement);
    const stores = useReviewStores();
    const engageGrid = useView((s) => s.engageGrid);
    const point = useView((s) => s.coordinates?.point ?? null);
    const editable = useIsEditable();
    const points = useSession((s) => selectShownPoints(s, analysis.key));
    const [allColumns, setAllColumns] = useState(false);
    const [held, setHeld] = useState<CoordinateAnalysis | null>(null);
    const [begun, setBegun] = useState<{ engagement: GridEngagement; request: number } | null>(null);
    const engaged = request !== null;
    if (engaged && held !== analysis) setHeld(analysis);
    if (!engaged && begun) setBegun(null);
    useEffect(
        () =>
            stores.view.subscribe((state, before) => {
                if (state.gridEngagement === null && before.gridEngagement !== null) dropHeldKeys();
            }),
        [stores]
    );
    useEffect(() => () => dropHeldKeys(), []);
    const engagement = useMemo(
        () =>
            request === null
                ? null
                : begun?.request === request
                  ? begun.engagement
                  : { kind: 'select' as const, row: stores.view.getState().coordinates?.point ?? 0, column: 0 },
        [request, begun, stores]
    );
    const onEngage = (next: GridEngagement) => setBegun({ engagement: next, request: engageGrid() });
    const rows = useMemo(() => toRows(points), [points]);
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
            readOnly={!editable}
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
            {children}
            <MoreColumns shown={allColumns} onToggle={() => setAllColumns((shown) => !shown)} />
        </>
    );
}

/** In place of the grid when its chunk did not load: says so, and lets go of the keys held for the grid. */
function GridUnavailable() {
    useEffect(() => dropHeldKeys(), []);
    return (
        <Typography role="alert" variant="caption" color="error">
            The point grid did not load; reload the page to edit the points
        </Typography>
    );
}

/** The button that shows or hides the point columns the grid leaves out at first. */
export function MoreColumns({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
    return (
        <Hint title="Show or hide the grid's other point columns">
            <Button size="small" aria-pressed={shown} onClick={onToggle}>
                More columns
            </Button>
        </Hint>
    );
}

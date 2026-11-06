import { CoordinateTable, type CoordinateTableHandle } from '@neurosynth/coordinate-table';
import { Typography } from '@mui/material';
import { useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import type { CoordinatePoint } from '../model/coordinates';
import { pairProblems, pointColumns, toPoints, toRows } from './pointRows';

/** What the Add analysis form asks of its grid. */
export interface NewPointsHandle {
    /** The points of the rows filled in, or null after marking what keeps them from being points. */
    points(): CoordinatePoint[] | null;
}

const ignore = () => {};

/** The points of an analysis not yet added, in the point grid: `first` as row 1, or one empty row. */
export default function NewPointsTable({
    first,
    space,
    allColumns,
    ref,
}: {
    first: CoordinatePoint | null;
    space: string;
    allColumns: boolean;
    ref?: Ref<NewPointsHandle>;
}) {
    const grid = useRef<CoordinateTableHandle>(null);
    const [rows] = useState(() => (first ? toRows([first]) : [{}]));
    const [problems, setProblems] = useState<string[]>([]);
    const columns = useMemo(() => pointColumns(space, allColumns), [space, allColumns]);
    useImperativeHandle(ref, () => ({
        points: () => {
            const filled = grid.current?.filledRows() ?? null;
            const found = filled ? pairProblems(filled) : [];
            setProblems(found);
            return filled && found.length === 0 ? toPoints(filled) : null;
        },
    }));
    return (
        <>
            <CoordinateTable
                ref={grid}
                label="points of the new analysis"
                points={rows}
                columns={columns}
                onChange={ignore}
            />
            {problems.map((problem) => (
                <Typography key={problem} variant="caption" color="error" component="div">
                    {problem}
                </Typography>
            ))}
        </>
    );
}

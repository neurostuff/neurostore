import type { MouseEvent } from 'react';
import type { CoordinateAnalysis } from '../model/coordinates';
import { useReviewStore } from '../store/context';
import { COORDINATE_SCHEMA, gridColumns, pointFields } from './schema';

const COLUMNS = gridColumns(pointFields(COORDINATE_SCHEMA));

/** The points of one analysis, a row each; click focuses a point, Shift+click selects it. */
export function PointGrid({
    analysis,
    focusedPoint,
    selected,
}: {
    analysis: CoordinateAnalysis;
    focusedPoint: number | null;
    selected: number[];
}) {
    const focusAnalysis = useReviewStore((s) => s.focusAnalysis);
    const togglePoint = useReviewStore((s) => s.togglePoint);
    const onRow = (index: number) => (event: MouseEvent) => {
        event.stopPropagation();
        focusAnalysis(analysis.key, index);
        if (event.shiftKey) togglePoint(index);
    };
    return (
        <table className="rv-points" role="grid" aria-label={`points of ${analysis.name}`} aria-multiselectable="true">
            <thead>
                <tr>
                    <th role="columnheader" scope="col">
                        <span className="rv-visually-hidden">selected</span>
                    </th>
                    {COLUMNS.map((column) => (
                        <th key={column.label} role="columnheader" scope="col">
                            {column.label}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {(analysis.points ?? []).map((point, i) => (
                    <tr
                        key={i}
                        aria-rowindex={i + 2}
                        aria-selected={selected.includes(i)}
                        aria-current={focusedPoint === i ? 'true' : undefined}
                        onClick={onRow(i)}
                    >
                        <td role="gridcell">
                            <span aria-hidden="true">{selected.includes(i) ? '✓' : ''}</span>
                        </td>
                        {COLUMNS.map((column) => (
                            <td key={column.label} role="gridcell">
                                {column.text(point)}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

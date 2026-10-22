import { memo, type ReactElement } from 'react';
import { STATUSES, type Shape, type StatusId } from './status';

const SHAPES: Record<Shape, ReactElement> = {
    ring: <circle cx="5" cy="5" r="3.75" fill="none" stroke="currentColor" strokeWidth="2.5" />,
    dashed: (
        <circle cx="5" cy="5" r="3.75" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 1.5" />
    ),
    triangle: <polygon points="5,0.5 9.5,9.5 0.5,9.5" fill="currentColor" />,
    diamond: <polygon points="5,0 10,5 5,10 0,5" fill="currentColor" />,
    bar: <rect x="0" y="3.5" width="10" height="3" fill="currentColor" />,
    circle: <circle cx="5" cy="5" r="5" fill="currentColor" />,
    square: <rect x="0.5" y="0.5" width="9" height="9" fill="currentColor" />,
    check: <polyline points="1,5.5 4,8.5 9,1.5" fill="none" stroke="currentColor" strokeWidth="2.5" />,
    pencil: <polygon points="0.5,9.5 1.5,6.5 7,1 9,3 3.5,8.5" fill="currentColor" />,
    cross: <path d="M1,1 L9,9 M9,1 L1,9" stroke="currentColor" strokeWidth="2.5" />,
    plus: <path d="M5,0.5 V9.5 M0.5,5 H9.5" stroke="currentColor" strokeWidth="2.5" />,
    dot: <circle cx="5" cy="5" r="2" fill="currentColor" />,
};

export function StatusLabel({ id, by }: { id: StatusId; by?: string }) {
    const { label, shape, means } = STATUSES[id];
    const text = by ? `${label} by ${by}` : label;
    return (
        <span className="rv-status" data-status={id} data-status-shape={shape} title={by ? text : `${label}: ${means}`}>
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                {SHAPES[shape]}
            </svg>
            {text}
        </span>
    );
}

/**
 * A status by its mark alone, its label on hover; where `explained`, what it means too, and an image named by its
 * label, with who gave it where `by` names them.
 */
export function StatusMark({ id, explained, by }: { id: StatusId; explained?: boolean; by?: string }) {
    const { label, shape, means } = STATUSES[id];
    const named = by ? `${label} by ${by}` : label;
    return (
        <span
            className="rv-status"
            data-status={id}
            data-status-shape={shape}
            title={by ? named : explained ? `${label}: ${means}` : label}
            {...(explained && { role: 'img', 'aria-label': named })}
        >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                {SHAPES[shape]}
            </svg>
        </span>
    );
}

/** The statuses a field shows, as the legend names them in a word or two: its evidence, then its review. */
const LEGEND: [StatusId, string][] = [
    ['present', 'evidence'],
    ['not_found', 'not found'],
    ['generated', 'generated'],
    ['ambiguous', 'ambiguous'],
    ['not_reported', 'not reported'],
    ['absent', 'not in record'],
    ['reference', 'link'],
    ['verified', 'verified'],
    ['edited', 'edited'],
    ['rejected', 'rejected'],
    ['unchecked', 'unchecked'],
];

/** One line naming each field status by its mark, each explained on hover, and what a dashed underline means. */
export const StatusLegend = memo(function StatusLegend() {
    return (
        <ul className="rv-legend" aria-label="what the marks mean">
            {LEGEND.map(([id, words]) => (
                <li key={id} className="rv-legend-item" data-status={id}>
                    <StatusMark id={id} explained />
                    {words}
                </li>
            ))}
            <li className="rv-legend-item">dashed = to check</li>
        </ul>
    );
});

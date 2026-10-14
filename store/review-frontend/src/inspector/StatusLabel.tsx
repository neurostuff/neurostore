import type { ReactElement } from 'react';
import { STATUSES, type Shape, type StatusId } from './status';

const SHAPES: Record<Shape, ReactElement> = {
    ring: <circle cx="5" cy="5" r="3.75" fill="none" stroke="currentColor" strokeWidth="2.5" />,
    triangle: <polygon points="5,0.5 9.5,9.5 0.5,9.5" fill="currentColor" />,
    diamond: <polygon points="5,0 10,5 5,10 0,5" fill="currentColor" />,
    bar: <rect x="0" y="3.5" width="10" height="3" fill="currentColor" />,
    circle: <circle cx="5" cy="5" r="5" fill="currentColor" />,
    square: <rect x="0.5" y="0.5" width="9" height="9" fill="currentColor" />,
};

export function StatusLabel({ id }: { id: StatusId }) {
    const { label, shape } = STATUSES[id];
    return (
        <span className="rv-status" data-status={id} data-status-shape={shape}>
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                {SHAPES[shape]}
            </svg>
            {label}
        </span>
    );
}

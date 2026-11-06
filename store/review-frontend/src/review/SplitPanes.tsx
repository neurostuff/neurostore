import { Box } from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
    useLayoutEffect,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent,
    type PointerEvent,
    type ReactNode,
} from 'react';
import { DEFAULT_SHARE, MIN_INSPECTOR_PX, MIN_SHARE, readShare, SHIFT_STEP, STEP, writeShare } from './paneShare';

const DIVIDER_PX = 6;

/** The text pane's widest share of `width` pixels that leaves the inspector its least; any share while unmeasured. */
const maxShare = (width: number) =>
    width > 0 ? Math.max(MIN_SHARE, Math.floor(((width - MIN_INSPECTOR_PX - DIVIDER_PX) / width) * 100)) : 100;

const clamp = (share: number, width: number) => Math.min(maxShare(width), Math.max(MIN_SHARE, share));

const toCss = (share: number) => `${share}%`;

interface Drag {
    left: number;
    width: number;
    share: number;
    frame: number;
}

/** The paper text beside the inspector, with a divider between them that sets the text's share of the width. */
export function SplitPanes({ viewer, text, inspector }: { viewer?: string; text: ReactNode; inspector: ReactNode }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const drag = useRef<Drag | null>(null);
    const [share, setShare] = useState(() => readShare(viewer) ?? DEFAULT_SHARE);
    const [width, setWidth] = useState(0);
    const [dragging, setDragging] = useState(false);
    useLayoutEffect(() => {
        const measure = () => setWidth(containerRef.current!.getBoundingClientRect().width);
        measure();
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(measure);
        observer.observe(containerRef.current!);
        return () => observer.disconnect();
    }, []);
    const shown = clamp(share, width);

    const commitShare = (next: number) => {
        setShare(next);
        writeShare(viewer, next);
    };
    const onKeyDown = (event: KeyboardEvent) => {
        const step = event.shiftKey ? SHIFT_STEP : STEP;
        const keys: Record<string, number> = {
            ArrowLeft: shown - step,
            ArrowRight: shown + step,
            Home: MIN_SHARE,
            End: maxShare(width),
        };
        const next = keys[event.key];
        if (next === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        commitShare(clamp(next, width));
    };
    const onPointerDown = (event: PointerEvent<HTMLElement>) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        const { left, width } = containerRef.current!.getBoundingClientRect();
        drag.current = { left, width, share: shown, frame: 0 };
        setDragging(true);
    };
    const onPointerMove = (event: PointerEvent<HTMLElement>) => {
        const current = drag.current;
        if (!current) return;
        const share = clamp(((event.clientX - current.left) / current.width) * 100, current.width);
        current.share = Math.round(share * 10) / 10;
        if (current.frame) return;
        current.frame = requestAnimationFrame(() => {
            current.frame = 0;
            containerRef.current?.style.setProperty('--text-share', toCss(current.share));
        });
    };
    /** Ends the drag where the pointer last was, whether it came up or the browser cancelled it. */
    const onPointerUp = () => {
        const current = drag.current;
        if (!current) return;
        cancelAnimationFrame(current.frame);
        drag.current = null;
        containerRef.current?.style.setProperty('--text-share', toCss(current.share));
        setDragging(false);
        commitShare(current.share);
    };

    return (
        <Box
            ref={containerRef}
            style={{ '--text-share': toCss(shown) } as CSSProperties}
            sx={{ display: 'flex', flex: 1, minWidth: 0 }}
        >
            <Box component="main" sx={{ flex: '0 0 var(--text-share)', minWidth: 0 }}>
                {text}
            </Box>
            <Box
                role="separator"
                tabIndex={0}
                aria-orientation="vertical"
                aria-label="Resize the text and the review panes"
                aria-valuenow={shown}
                aria-valuemin={MIN_SHARE}
                aria-valuemax={maxShare(width)}
                data-dragging={dragging || undefined}
                onKeyDown={onKeyDown}
                onDoubleClick={() => commitShare(DEFAULT_SHARE)}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                sx={(theme) => ({
                    flex: `0 0 ${DIVIDER_PX}px`,
                    cursor: 'col-resize',
                    touchAction: 'none',
                    borderLeft: 1,
                    borderColor: 'divider',
                    transition: 'background-color 120ms',
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.3) },
                    '&[data-dragging]': { bgcolor: 'primary.main' },
                    '&:focus-visible': {
                        outline: 2,
                        outlineStyle: 'solid',
                        outlineColor: 'primary.main',
                        outlineOffset: -2,
                    },
                })}
            />
            <Box component="aside" aria-label="review" sx={{ flex: '1 1 0', minWidth: 0, overflow: 'auto' }}>
                {inspector}
            </Box>
        </Box>
    );
}

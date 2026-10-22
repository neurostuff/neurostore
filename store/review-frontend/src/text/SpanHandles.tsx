import CloseIcon from '@mui/icons-material/Close';
import { Box, IconButton } from '@mui/material';
import { useContext, useLayoutEffect, useState, type MouseEvent, type PointerEvent, type RefObject } from 'react';
import type { SpanPair } from '../model/record';
import { useIsEditable, useReviewStores, useSession, useSessionView } from '../store/context';
import { selectCursorSpan } from '../store/viewSelectors';
import type { HighlightLayer } from './highlights';
import { place, REMOVE_SIZE, samePlaced, type Placed } from './placement';
import { moveEdge, type Edge } from './snap';
import { moveCursorSpan, removeCursorSpan } from './spanEdits';
import { offsetAtPoint } from './supporting';
import { useResized } from './useResized';
import { TextIndexContext } from './useTextIndex';

const stopClick = (event: MouseEvent) => event.stopPropagation();

/** The focused span's drag handles and remove control; a span in a table cell gets the control only. */
export function SpanHandles({
    scrollerRef,
    textRef,
    layer,
}: {
    scrollerRef: RefObject<HTMLElement | null>;
    textRef: RefObject<HTMLElement | null>;
    layer: HighlightLayer | null;
}) {
    const stores = useReviewStores();
    const index = useContext(TextIndexContext);
    const text = useSession((s) => s.bundle.text);
    const span = useSessionView(selectCursorSpan);
    const editable = useIsEditable();
    const resizes = useResized(scrollerRef, textRef);
    const [moving, setMoving] = useState<{ edge: Edge; span: SpanPair } | null>(null);
    const [placed, setPlaced] = useState<Placed | null>(null);
    const [from, to] = moving?.span ?? span ?? [];

    useLayoutEffect(() => {
        const scroller = scrollerRef.current;
        const shown = from !== undefined && to !== undefined && layer && scroller;
        const columnRight = (textRef.current ?? scroller)?.getBoundingClientRect().right ?? 0;
        const next = shown ? place(scroller, layer.range([from, to]), columnRight) : null;
        setPlaced((prev) => (samePlaced(prev, next) ? prev : next));
    }, [scrollerRef, textRef, layer, from, to, resizes]);

    if (!span || !placed) return null;

    const grab = (edge: Edge) => (event: PointerEvent) => {
        if (!editable) return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setMoving({ edge, span });
    };
    const drag = (event: PointerEvent) => {
        const offset = moving && index && offsetAtPoint(index, event.clientX, event.clientY);
        if (!moving || offset == null) return;
        const next = moveEdge(text, span, moving.edge, offset);
        if (next[0] === moving.span[0] && next[1] === moving.span[1]) return;
        layer?.moving(next);
        setMoving({ edge: moving.edge, span: next });
    };
    const finish = (send: boolean) => () => {
        if (!moving) return;
        layer?.moving(null);
        setMoving(null);
        if (send) moveCursorSpan(stores, moving.span);
    };

    const handle = (edge: Edge) => (
        <Box
            component="span"
            role="button"
            aria-label={`move the evidence ${edge}`}
            aria-disabled={!editable}
            onPointerDown={grab(edge)}
            onPointerMove={drag}
            onPointerUp={finish(true)}
            onPointerCancel={finish(false)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={stopClick}
            style={placed[edge]}
            sx={{
                position: 'absolute',
                width: 10,
                transform: 'translateX(-5px)',
                cursor: editable ? 'ew-resize' : 'default',
                userSelect: 'none',
                touchAction: 'none',
                '&::after': {
                    content: '""',
                    position: 'absolute',
                    left: 4,
                    top: -3,
                    bottom: -3,
                    width: 2,
                    bgcolor: 'secondary.main',
                },
            }}
        />
    );

    return (
        <>
            {!placed.inTable && handle('start')}
            {!placed.inTable && handle('end')}
            <IconButton
                size="small"
                aria-label="remove this evidence span"
                disabled={!editable}
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                    event.stopPropagation();
                    removeCursorSpan(stores, span);
                }}
                style={{ left: placed.remove.left, top: placed.remove.top }}
                sx={{
                    position: 'absolute',
                    width: REMOVE_SIZE,
                    height: REMOVE_SIZE,
                    p: 0.25,
                    bgcolor: 'background.paper',
                }}
            >
                <CloseIcon fontSize="inherit" />
            </IconButton>
        </>
    );
}

import { Box } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useLayoutEffect, useMemo, useState, type RefObject } from 'react';
import type { SpanPair } from '../model/record';
import { useReviewStores, useSessionView } from '../store/context';
import { NO_SPANS, selectFocusedSpans, selectShown } from '../store/viewSelectors';
import type { HighlightLayer } from './highlights';
import { inContent } from './placement';
import { useResized } from './useResized';

interface Tick {
    span: SpanPair;
    top: number;
}

interface Ticks {
    focused: Tick[];
    others: Tick[];
}

/** Where each span sits down the scroller's content, as a fraction of its scroll height. */
function measure(scroller: HTMLElement, layer: HighlightLayer, spans: SpanPair[]): Tick[] {
    const height = scroller.scrollHeight;
    if (!height) return [];
    return spans.flatMap((span) => {
        const [rect] = layer.range(span).getClientRects();
        return rect ? [{ span, top: inContent(scroller, rect).top / height }] : [];
    });
}

/** A rail beside the text's scrollbar, with a tick at each focused span and, while all evidence is shown, a faint one at every other. */
export function SpanTicks({
    scrollerRef,
    textRef,
    layer,
}: {
    scrollerRef: RefObject<HTMLElement | null>;
    textRef: RefObject<HTMLElement | null>;
    layer: HighlightLayer | null;
}) {
    const { view } = useReviewStores();
    const focused = useSessionView(selectFocusedSpans);
    const all = useSessionView((session, state) =>
        state.showAllEvidence ? selectShown(session, state).allSpans : NO_SPANS
    );
    const others = useMemo(() => {
        const shown = new Set(focused.map((span) => span.join(':')));
        return all.filter((span) => !shown.has(span.join(':')));
    }, [focused, all]);
    const resizes = useResized(scrollerRef, textRef);
    const [ticks, setTicks] = useState<Ticks>({ focused: [], others: [] });

    useLayoutEffect(() => {
        const scroller = scrollerRef.current;
        if (!scroller || !layer) return;
        setTicks({ focused: measure(scroller, layer, focused), others: measure(scroller, layer, others) });
    }, [scrollerRef, layer, focused, others, resizes]);

    const jump = (span: SpanPair, focusedTick: boolean) => {
        const { showSpan, revealSpan } = view.getState();
        if (focusedTick) showSpan(span);
        revealSpan(span);
    };
    return (
        <Box data-span-ticks sx={{ position: 'relative', width: 10, flexShrink: 0 }}>
            {ticks.others.map(({ span, top }) => (
                <TickMark key={span.join(':')} label="other evidence" top={top} onClick={() => jump(span, false)} />
            ))}
            {ticks.focused.map(({ span, top }, i) => (
                <TickMark
                    key={span.join(':')}
                    label={`evidence ${i + 1}`}
                    top={top}
                    focused
                    onClick={() => jump(span, true)}
                />
            ))}
        </Box>
    );
}

function TickMark({
    label,
    top,
    focused = false,
    onClick,
}: {
    label: string;
    top: number;
    focused?: boolean;
    onClick: () => void;
}) {
    return (
        <Box
            component="button"
            type="button"
            tabIndex={-1}
            aria-label={label}
            onClick={onClick}
            style={{ top: `${top * 100}%` }}
            sx={(theme) => ({
                position: 'absolute',
                left: 0,
                width: '100%',
                height: 3,
                p: 0,
                border: 0,
                cursor: 'pointer',
                bgcolor: focused ? 'primary.main' : alpha(theme.palette.primary.main, 0.3),
            })}
        />
    );
}

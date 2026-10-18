import { Button, Paper, Typography } from '@mui/material';
import { useContext, useEffect, useLayoutEffect, useMemo, useState, type RefObject } from 'react';
import { addSelectionToAnalysis, textAnalysisPanel } from '../coordinates/actions';
import { coordinatePending, namingSlot } from '../coordinates/availability';
import { focusedAnalysis } from '../model/coordinateFocus';
import type { SpanPair } from '../model/record';
import { useIsEditable, useReviewStores, useSession, useSessionView, useView } from '../store/context';
import { canAddEvidence } from '../store/sessionStore';
import { addSelection } from './addSelection';
import { snapToWords } from './snap';
import { useSelectionOffsets } from './useSelectionOffsets';
import { TextIndexContext } from './useTextIndex';
import { slotLabel } from '../model/labels';
import { Hint } from '../review/Hint';

interface Anchor {
    top: number;
    left: number;
}

function anchorOf(scroller: HTMLElement, rect: DOMRect): Anchor {
    const box = scroller.getBoundingClientRect();
    return { top: rect.bottom - box.top + scroller.scrollTop + 4, left: Math.max(rect.left - box.left, 0) };
}

/** The selection bar while a coordinate analysis is in focus: the selection as its sentence, or as a new analysis. */
function AnalysisSelectionBar({ anchor, selection }: { anchor: Anchor; selection: SpanPair }) {
    const stores = useReviewStores();
    const editable = useIsEditable();
    const pending = useSession(coordinatePending);
    const openPanel = useView((s) => s.openPanel);
    const canName = useSessionView((session, view) => {
        const analysis = focusedAnalysis({ bundle: session.bundle, coordinates: view.coordinates });
        return !!analysis && namingSlot(session.index, analysis) !== undefined;
    });
    return (
        <Paper
            role="toolbar"
            aria-label="selection"
            elevation={3}
            onMouseDown={(event) => event.preventDefault()}
            style={anchor}
            sx={{ position: 'absolute', zIndex: 1, display: 'flex', alignItems: 'center', gap: 0.5, p: 0.5 }}
        >
            <Button size="small" disabled={!editable || !canName} onClick={() => addSelectionToAnalysis(stores)}>
                Add as the analysis’s sentence (E)
            </Button>
            <Button
                size="small"
                disabled={!editable || pending}
                onClick={() => openPanel(textAnalysisPanel(selection))}
            >
                New coordinate analysis from selection
            </Button>
        </Paper>
    );
}

export function SelectionBar({ scrollerRef }: { scrollerRef: RefObject<HTMLElement | null> }) {
    const stores = useReviewStores();
    const text = useSession((s) => s.bundle.text);
    const selection = useView((s) => s.selection);
    const focused = useView((s) => s.focus.key);
    const editable = useIsEditable();
    const canAdd = useSession((s) => canAddEvidence(s.index.slot(focused))) && editable;
    const needsValue = useSession((s) => s.index.slot(focused)?.value?.extraction_status === 'not_reported');
    const onAnalysis = useView((s) => s.coordinates !== null);
    const target = useSession((s) => {
        const slot = s.index.slot(focused);
        return slot
            ? `${s.index.entity(slot.entity)?.name ?? slot.entity} · ${slotLabel(s.index, slot)}`
            : 'the focused field';
    });
    const { offsets, rect } = useSelectionOffsets(useContext(TextIndexContext));
    const snapped = useMemo(() => offsets && snapToWords(text, offsets[0], offsets[1]), [text, offsets]);
    const [anchor, setAnchor] = useState<Anchor | null>(null);

    useEffect(() => stores.view.getState().setSelection(snapped), [stores, snapped]);
    useLayoutEffect(() => {
        setAnchor(rect && scrollerRef.current ? anchorOf(scrollerRef.current, rect) : null);
    }, [rect, scrollerRef]);

    if (!selection || !anchor) return null;
    if (onAnalysis) return <AnalysisSelectionBar anchor={anchor} selection={selection} />;
    return (
        <Paper
            role="toolbar"
            aria-label="selection"
            elevation={3}
            onMouseDown={(event) => event.preventDefault()}
            style={anchor}
            sx={{ position: 'absolute', zIndex: 1, display: 'flex', alignItems: 'center', gap: 0.5, p: 0.5 }}
        >
            <Button size="small" disabled={!canAdd} onClick={() => addSelection(stores, 'first')}>
                {`Add as evidence for ${target} (E)`}
            </Button>
            <Hint title="A separate passage that supports the value on its own, apart from the evidence it has">
                <span>
                    <Button size="small" disabled={!canAdd} onClick={() => addSelection(stores, 'new')}>
                        {`New evidence set for ${target} (Shift+E)`}
                    </Button>
                </span>
            </Hint>
            {needsValue && (
                <Typography variant="caption" sx={{ px: 1 }}>
                    set a value first
                </Typography>
            )}
        </Paper>
    );
}

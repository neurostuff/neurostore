import { Button, Paper, Typography } from '@mui/material';
import { useContext, useEffect, useLayoutEffect, useMemo, useState, type RefObject } from 'react';
import { useReviewStores, useSession, useView } from '../store/context';
import { canAddEvidence } from '../store/sessionStore';
import { addSelection } from './addSelection';
import { snapToWords } from './snap';
import { useSelectionOffsets } from './useSelectionOffsets';
import { TextIndexContext } from './useTextIndex';

interface Anchor {
    top: number;
    left: number;
}

function anchorOf(scroller: HTMLElement, rect: DOMRect): Anchor {
    const box = scroller.getBoundingClientRect();
    return { top: rect.bottom - box.top + scroller.scrollTop + 4, left: Math.max(rect.left - box.left, 0) };
}

export function SelectionBar({ scrollerRef }: { scrollerRef: RefObject<HTMLElement | null> }) {
    const stores = useReviewStores();
    const text = useSession((s) => s.bundle.text);
    const selection = useView((s) => s.selection);
    const focused = useView((s) => s.focus.key);
    const canAdd = useSession((s) => canAddEvidence(s.index.slot(focused)));
    const needsValue = useSession((s) => s.index.slot(focused)?.value?.extraction_status === 'not_reported');
    const { offsets, rect } = useSelectionOffsets(useContext(TextIndexContext));
    const snapped = useMemo(() => offsets && snapToWords(text, offsets[0], offsets[1]), [text, offsets]);
    const [anchor, setAnchor] = useState<Anchor | null>(null);

    useEffect(() => stores.view.getState().setSelection(snapped), [stores, snapped]);
    useLayoutEffect(() => {
        setAnchor(rect && scrollerRef.current ? anchorOf(scrollerRef.current, rect) : null);
    }, [rect, scrollerRef]);

    if (!selection || !anchor) return null;
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
                Add to evidence (E)
            </Button>
            <Button size="small" disabled={!canAdd} onClick={() => addSelection(stores, 'new')}>
                New evidence set (Shift+E)
            </Button>
            {needsValue && (
                <Typography variant="caption" sx={{ px: 1 }}>
                    set a value first
                </Typography>
            )}
        </Paper>
    );
}

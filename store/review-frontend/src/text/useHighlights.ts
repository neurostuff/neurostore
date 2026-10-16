import { useLayoutEffect, useMemo } from 'react';
import type { SpanPair } from '../model/record';
import { useReviewStores } from '../store/context';
import { selectOriginalSpans } from '../store/diffSelectors';
import { selectFocusedSpans, selectShown } from '../store/viewSelectors';
import { HighlightLayer, type HighlightNames } from './highlights';
import type { TextIndex } from './TextIndex';

export function useHighlights(index: TextIndex | null, names: HighlightNames): HighlightLayer | null {
    const { session, view } = useReviewStores();
    const layer = useMemo(() => index && new HighlightLayer(index, names), [index, names]);

    useLayoutEffect(() => {
        if (!layer) return;
        let painted: SpanPair[][] = [];
        const paint = () => {
            const documents = session.getState();
            const focus = view.getState();
            const spans = [
                selectFocusedSpans(documents, focus),
                selectShown(documents, focus).allSpans,
                selectOriginalSpans(documents, focus),
            ];
            if (spans.every((s, i) => s === painted[i])) return;
            painted = spans;
            layer.update(spans[0], spans[1], spans[2]);
        };
        paint();
        const unsubscribeSession = session.subscribe(paint);
        const unsubscribeView = view.subscribe(paint);
        return () => {
            unsubscribeSession();
            unsubscribeView();
            layer.clear();
        };
    }, [session, view, layer]);

    return layer;
}

import { useLayoutEffect, useMemo } from 'react';
import { useReviewStoreApi } from '../store/context';
import type { ReviewState } from '../store/reviewStore';
import { HighlightLayer, type HighlightNames } from './highlights';
import type { TextIndex } from './TextIndex';

export function useHighlights(index: TextIndex | null, names: HighlightNames): HighlightLayer | null {
    const store = useReviewStoreApi();
    const layer = useMemo(() => index && new HighlightLayer(index, names), [index, names]);

    useLayoutEffect(() => {
        if (!layer) return;
        const paint = (s: ReviewState) => layer.update(s.focusedSpans, s.index.allSpans);
        paint(store.getState());
        const unsubscribe = store.subscribe((s, prev) => {
            if (s.focusedSpans !== prev.focusedSpans || s.index.allSpans !== prev.index.allSpans) paint(s);
        });
        return () => {
            unsubscribe();
            layer.clear();
        };
    }, [store, layer]);

    return layer;
}

import { createContext, useLayoutEffect, useState, type RefObject } from 'react';
import { TextIndex } from './TextIndex';

export const TextIndexContext = createContext<TextIndex | null>(null);

export function useTextIndex(rootRef: RefObject<HTMLElement | null>): TextIndex | null {
    const [index, setIndex] = useState<TextIndex | null>(null);
    useLayoutEffect(() => {
        if (rootRef.current) setIndex(TextIndex.build(rootRef.current));
    }, [rootRef]);
    return index;
}

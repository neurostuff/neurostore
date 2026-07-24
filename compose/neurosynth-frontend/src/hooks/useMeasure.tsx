import { useEffect, useRef, useState } from 'react';

interface UseMeasureResult<T extends HTMLElement> {
    ref: React.RefObject<T>;
    width: number;
    height: number;
}

const useMeasure = <T extends HTMLElement>(): UseMeasureResult<T> => {
    const ref = useRef<T>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const resizeObserver = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            const borderBox = entry.borderBoxSize[0];
            if (!borderBox) return;
            const width = borderBox.inlineSize;
            const height = borderBox.blockSize;
            setDimensions({ width, height });
        });

        resizeObserver.observe(element);

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    return { ref, ...dimensions };
};

export default useMeasure;

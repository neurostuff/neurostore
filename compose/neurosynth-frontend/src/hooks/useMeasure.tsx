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
            if (!entries[0]) return;
            const { width, height } = entries[0].contentRect;
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

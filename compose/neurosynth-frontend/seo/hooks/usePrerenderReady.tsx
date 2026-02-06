import { useEffect, useRef } from 'react';
import { DEFAULT_PRERENDER_EVENT } from '../seo.config.js';

const usePrerenderReady = (isReady: boolean) => {
    const hasFired = useRef(false);

    useEffect(() => {
        if (!isReady || hasFired.current) return;

        hasFired.current = true;
        if (typeof document !== 'undefined') {
            document.dispatchEvent(new Event(DEFAULT_PRERENDER_EVENT));
        }
    }, [isReady]);
};

export default usePrerenderReady;

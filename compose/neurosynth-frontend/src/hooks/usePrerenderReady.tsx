import { useEffect, useRef } from 'react';
import { getPrerenderEvent } from '../../seo.config.js';

const usePrerenderReady = (isReady: boolean) => {
    const hasFired = useRef(false);

    useEffect(() => {
        if (!isReady || hasFired.current) {
            return;
        }

        hasFired.current = true;
        if (typeof document !== 'undefined') {
            const eventName = getPrerenderEvent(import.meta.env);
            document.dispatchEvent(new Event(eventName));
        }
    }, [isReady]);
};

export default usePrerenderReady;

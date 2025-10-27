import { useEffect, useState } from 'react';

const useGetWindowWidth = (debounceMs: number = 150) => {
    const [windowWidth, setWindowWidth] = useState(0);

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;

        const handleResize = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                const currentWindowSize = window.innerWidth;
                if (currentWindowSize) {
                    setWindowWidth(currentWindowSize);
                }
            }, debounceMs);
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('resize', handleResize);
        };
    }, [debounceMs]);
    return windowWidth;
};

export default useGetWindowWidth;

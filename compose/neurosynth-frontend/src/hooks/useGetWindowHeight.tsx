import { useEffect, useState } from 'react';

const useGetWindowHeight = () => {
    const [windowHeight, setWindowHeight] = useState(0);

    useEffect(() => {
        const handleResize = () => {
            const currentWindowSize = window.innerHeight;
            if (currentWindowSize) {
                setWindowHeight(currentWindowSize);
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize();

        // remove listeners on cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [windowHeight]);
    return windowHeight;
};

export default useGetWindowHeight;

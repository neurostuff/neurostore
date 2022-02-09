import { useEffect, useState } from 'react';

const getWindowDimensions = () => {
    const { innerWidth: windowWidth, innerHeight: windowHeight } = window;
    return { windowWidth, windowHeight };
};

const useWindowDimensions = () => {
    const [windowDimensions, setWindowDimensions] = useState<{
        windowWidth: number;
        windowHeight: number;
    }>(getWindowDimensions());

    useEffect(() => {
        const handleResize = () => {
            setWindowDimensions(getWindowDimensions());
        };

        window.addEventListener('resize', handleResize);

        // clean up function
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return windowDimensions;
};

export default useWindowDimensions;

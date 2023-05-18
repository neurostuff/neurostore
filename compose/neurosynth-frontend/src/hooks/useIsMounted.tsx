import { useEffect, useRef } from 'react';

const useIsMounted = () => {
    const isMountedRef = useRef(true);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    });
    return isMountedRef;
};

export default useIsMounted;

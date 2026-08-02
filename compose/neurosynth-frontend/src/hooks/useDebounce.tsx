import { useEffect, useMemo, useState } from 'react';

const useDebounced = <T,>(args: T, debounceMs: number = 2500) => {
    const [debouncedArgs, setDebouncedArgs] = useState(args);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedArgs(args);
        }, debounceMs);

        return () => clearTimeout(timer);
    }, [args, debounceMs]);

    return debouncedArgs;
};

export default useDebounced;

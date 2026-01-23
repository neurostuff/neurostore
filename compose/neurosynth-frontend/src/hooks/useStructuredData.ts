import { useRef } from 'react';

type StructuredData = Record<string, unknown> | unknown[];

const useStructuredData = (factory: () => StructuredData) => {
    const jsonRef = useRef<string>();

    if (!jsonRef.current) {
        jsonRef.current = JSON.stringify(factory());
    }

    return jsonRef.current;
};

export default useStructuredData;

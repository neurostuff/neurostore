import { useEffect, useState } from 'react';
import { useProjectCurationAllStubs, useProjectCurationImports } from 'stores/ProjectStore/getters';
import { ICurationImportSummary } from './models';

const useGetCurationImportSummary = () => {
    const [importSummary, setImportSummary] = useState<ICurationImportSummary[]>([]);
    const allStubs = useProjectCurationAllStubs();
    const imports = useProjectCurationImports();

    useEffect(() => {
        const map = new Map<string, ICurationImportSummary>();
        imports.forEach((anImport) => {
            map.set(anImport.id, { ...anImport, numStudies: 0 });
        });

        allStubs.forEach((stub) => {
            const mapImport = map.get(stub.import.id);
            if (mapImport) mapImport.numStudies++;
        });

        setImportSummary((prev) => {
            if (map.size === 0) return prev;
            return Array.from(map.values());
        });
    }, [allStubs, imports]);

    return importSummary;
};

export default useGetCurationImportSummary;

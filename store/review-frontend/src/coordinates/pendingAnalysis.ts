import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { CoordinateAnalysis } from '../model/coordinates';
import { useSession } from '../store/context';
import { pendingFields } from '../store/pointEdits';

const NO_FIELDS = {};

/** The analysis with the name, role and coordinate space its pending ops give it, before the server answers. */
export function useAnalysisWithPending<A extends CoordinateAnalysis | undefined>(analysis: A): A {
    const key = analysis?.key;
    const fields = useSession(useShallow((s) => (key === undefined ? NO_FIELDS : pendingFields(s.pending, key))));
    return useMemo(
        () => (analysis && Object.keys(fields).length ? { ...analysis, ...fields } : analysis),
        [analysis, fields]
    );
}

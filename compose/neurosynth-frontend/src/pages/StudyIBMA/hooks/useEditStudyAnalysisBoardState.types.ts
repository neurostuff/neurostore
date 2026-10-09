import { AnalysisReturnNested } from 'hooks/analyses/analysisQueries.types';
import type { DefaultMapTypes } from 'stores/study/StudyStore.helpers';

export interface BrainMapListItem {
    id: string;
    name: string;
    mapType: keyof typeof DefaultMapTypes;
}

export type AnalysisBoardRow = AnalysisReturnNested & {
    analysisAnnotation: Record<string, string | boolean | number | null | undefined>; // Record<note_key, value>
};

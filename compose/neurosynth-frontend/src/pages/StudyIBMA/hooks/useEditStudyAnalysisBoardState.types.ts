import type { DefaultMapTypes } from 'stores/study/StudyStore.helpers';

export interface BrainMapListItem {
    id: string;
    name: string;
    mapType: keyof typeof DefaultMapTypes;
}

export interface AnalysisBoardRow {
    id: string;
    name: string;
    description: string;
    annotation: Record<string, string | boolean | number | null | undefined>;
}

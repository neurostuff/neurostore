import type { ImageReturn } from 'neurostore-typescript-sdk';
import type { DefaultMapTypes } from 'stores/study/StudyStore.helpers';

export type AnalysisBoardRowKind = 'analysis' | 'detail';

export interface UncategorizedImageEntry {
    image: ImageReturn;
    /** Analysis whose `images` array currently holds this row (nested payload). */
    holderAnalysisId: string;
}

export interface BrainMapListItem {
    id: string;
    name: string;
    mapType: keyof typeof DefaultMapTypes;
}

export interface AnalysisBoardRow {
    id: string;
    rowKind: AnalysisBoardRowKind;
    name: string;
    description: string;
    parentAnalysisId?: string;
    isExpanded?: boolean;
    /** Values keyed by annotation note_key for analysis rows */
    annotation: Record<string, string | boolean | number | null | undefined>;
}

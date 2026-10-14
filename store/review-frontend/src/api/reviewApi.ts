import type { ReviewBundle } from '../contract/generated/review-bundle';

export interface PaperSummary {
    id: string;
    label: string;
}

export interface ReviewApi {
    listPapers(): Promise<PaperSummary[]>;
    getBundle(id: string): Promise<ReviewBundle>;
}

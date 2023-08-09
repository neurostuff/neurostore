import { IImport } from 'interfaces/project/curation.interface';

export interface IExtractionSummary {
    savedForLater: number;
    uncategorized: number;
    completed: number;
    total: number;
}

export interface ICurationSummary {
    total: number;
    included: number;
    uncategorized: number;
    excluded: number;
}

export type ICurationImportSummary = IImport & { numStudies: number };

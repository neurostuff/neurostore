export enum EExtractionStatus {
    'COMPLETED' = 'completed',
    'SAVEDFORLATER' = 'savedforlater',
    'UNCATEGORIZED' = 'uncategorized',
}

export interface IStudyExtractionStatus {
    status: EExtractionStatus;
    id: string;
}

export interface IExtractionMetadata {
    studyStatusList: IStudyExtractionStatus[];
    annotationId: string | undefined;
    studysetId: string | undefined;
}

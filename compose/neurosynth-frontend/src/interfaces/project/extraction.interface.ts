export interface IStudyExtractionStatus {
    status: 'COMPLETE' | 'SAVEFORLATER';
    id: string;
}

export interface IExtractionMetadata {
    studyStatusList: IStudyExtractionStatus[];
    annotationId: string | undefined;
    studysetId: string | undefined;
}

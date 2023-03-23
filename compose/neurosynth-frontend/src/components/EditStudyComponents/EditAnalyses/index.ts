import { PointReturn } from 'neurostore-typescript-sdk';

export interface IEditAnalysisPoints {
    points: PointReturn[] | undefined;
    studyId: string | undefined;
    analysisId: string | undefined;
}

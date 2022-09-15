import { ConditionReturn, PointReturn } from 'neurostore-typescript-sdk';

export interface IEditAnalysisDetails {
    studyId: string;
    name: string;
    description: string;
    analysisId: string;
}

export interface IEditAnalysisPoints {
    points: PointReturn[] | undefined;
    studyId: string | undefined;
    analysisId: string | undefined;
}

export interface IEditAnalysisConditions {
    studyId: string | undefined;
    analysisId: string;
    conditions: ConditionReturn[] | undefined;
    weights: number[] | undefined;
}

import { ConditionReturn } from '../../../neurostore-typescript-sdk';
import { PointApiResponse } from '../../../utils/api';

export interface IEditAnalysisDetails {
    studyId: string;
    name: string;
    description: string;
    analysisId: string;
}

export interface IEditAnalysisPoints {
    points: PointApiResponse[] | undefined;
    studyId: string | undefined;
    analysisId: string | undefined;
}

export interface IEditAnalysisConditions {
    studyId: string | undefined;
    analysisId: string;
    conditions: ConditionReturn[] | undefined;
    weights: number[] | undefined;
}

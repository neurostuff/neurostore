import { AnalysisReturn, ConditionReturn, ImageReturn, PointReturn } from 'neurostore-typescript-sdk';

type AnalysisRelationshipKeys = 'images' | 'points' | 'conditions';

export type AnalysisReturnNonNested = Omit<AnalysisReturn, AnalysisRelationshipKeys> & {
    images?: Array<string>;
    points?: Array<string>;
    conditions?: Array<string>;
};

export type AnalysisReturnNested = Omit<AnalysisReturn, AnalysisRelationshipKeys> & {
    images?: Array<ImageReturn>;
    points?: Array<PointReturn>;
    conditions?: Array<ConditionReturn>;
};

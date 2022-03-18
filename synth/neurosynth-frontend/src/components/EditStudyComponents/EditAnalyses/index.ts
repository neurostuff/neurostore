import { AnalysisApiResponse, ConditionApiResponse, PointsApiResponse } from '../../../utils/api';

export interface IEditAnalysisDetailsFn {
    (idToUpdate: string, update: { [key: string]: any }): void;
}

export interface IEditAnalysisConditionsFn {
    (idtoUpdate: string, newConditions: ConditionApiResponse[], newWeights: number[]): void;
}

export interface IDeleteAnalysisFn {
    (idToDelete: string): void;
}

export interface IEditAnalyses {
    analyses: AnalysisApiResponse[] | undefined;
    onEditAnalysisPoints: (points: PointsApiResponse[]) => void;
    onEditAnalysisImages: () => void;
    onEditAnalysisDetails: IEditAnalysisDetailsFn;
    onEditAnalysisConditions: IEditAnalysisConditionsFn;
}

export interface IEditAnalysis {
    analysis: AnalysisApiResponse | undefined;
    onEditAnalysisPoints: (points: PointsApiResponse[]) => void;
    onDeleteAnalysis: IDeleteAnalysisFn;
    onEditAnalysisDetails: IEditAnalysisDetailsFn;
    onEditAnalysisConditions: IEditAnalysisConditionsFn;
}

export interface IEditAnalysisDetails {
    analysisId: string;
    name: string;
    description: string;
    onEditAnalysisDetails: (update: { [key: string]: any }) => void;
    onDeleteAnalysis: IDeleteAnalysisFn;
}

export interface IEditAnalysisPoints {
    onAddPoint: (arg: { x: number; y: number; z: number }) => void;
    onRemovePoint: (pointId: string) => void;
    onUpdatePoint: (pointId: string, update: { x: number; y: number; z: number }) => void;
    points: PointsApiResponse[] | undefined;
}

export interface IEditAnalysisConditions {
    analysisId: string;
    conditions: ConditionApiResponse[] | undefined;
    weights: number[] | undefined;
    onConditionWeightChange: IEditAnalysisConditionsFn;
}

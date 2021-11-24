import { AnalysisApiResponse, PointsApiResponse } from '../../../utils/api';

export interface IEditAnalysisDetailsFn {
    (idToUpdate: string, update: { [key: string]: any }): void;
}

export interface IDeleteAnalysisFn {
    (idToDelete: string): void;
}

export interface IEditAnalyses {
    analyses: AnalysisApiResponse[] | undefined;
    onEditAnalysisPoints: (points: PointsApiResponse[]) => void;
    onEditAnalysisImages: () => void;
    onEditAnalysisDetails: IEditAnalysisDetailsFn;
}

export interface IEditAnalysis {
    analysis: AnalysisApiResponse | undefined;
    onDeleteAnalysis: IDeleteAnalysisFn;
    onEditAnalysisDetails: IEditAnalysisDetailsFn;
    onEditAnalysisPoints: (points: PointsApiResponse[]) => void;
}

export interface IEditAnalysisDetails {
    analysisId: string;
    name: string | undefined | null;
    description: string | undefined | null;
    onEditAnalysisDetails: (update: { [key: string]: any }) => void;
    onDeleteAnalysis: IDeleteAnalysisFn;
}

export interface IEditAnalysisPoints {
    onAddPoint: (arg: { x: number; y: number; z: number }) => void;
    onRemovePoint: (pointId: string) => void;
    onUpdatePoint: (pointId: string, update: { x: number; y: number; z: number }) => void;
    points: PointsApiResponse[] | undefined;
}

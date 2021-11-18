import { AnalysisApiResponse, PointsApiResponse } from '../../../utils/api';

export interface IEditAnalysisDetailsFn {
    (idToUpdate: string, update: { key: string; value: string }): void;
}

export interface IEditAnalyses {
    analyses: AnalysisApiResponse[] | undefined;
    onEditAnalysisPoints: (points: PointsApiResponse[]) => void;
    onEditAnalysisImages: () => void;
    onEditAnalysisDetails: IEditAnalysisDetailsFn;
}

export interface IEditAnalysis {
    analysis: AnalysisApiResponse | undefined;
    onDeleteAnalysis: (idToDelete: string | undefined) => void;
    onEditAnalysisDetails: IEditAnalysisDetailsFn;
    onEditAnalysisPoints: (points: PointsApiResponse[]) => void;
}

export interface IEditAnalysisDetails {
    name: string | undefined | null;
    description: string | undefined | null;
    onEditAnalysisDetails: (key: string, value: string) => void;
}

export interface IEditAnalysisPoints {
    onAddPoint: (arg: { x: number; y: number; z: number }) => void;
    onRemovePoint: (pointId: string) => void;
    onUpdatePoint: (pointId: string, update: { x: number; y: number; z: number }) => void;
    points: PointsApiResponse[] | undefined;
}

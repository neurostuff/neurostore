import { Analysis, ConditionReturn } from '../../../neurostore-typescript-sdk';
import { AnalysisApiResponse, ConditionApiResponse, PointApiResponse } from '../../../utils/api';

export enum EAnalysisEdit {
    ALL = 'all',
    DETAILS = 'details',
    CONDITIONS = 'conditions',
    POINTS = 'points',
    IMAGES = 'images',
}

export enum EAnalysisEditButtonType {
    SAVE = 'save',
    CANCEL = 'cancel',
    DELETE = 'delete',
}

export interface IEditAnalysisDetailsFn {
    (analysis: Analysis): void;
}

export interface IEditAnalysisConditionsFn {
    (newConditions: ConditionApiResponse[], newWeights: number[]): void;
}

export interface IOnButtonPressFn {
    (editor: EAnalysisEdit, buttonType: EAnalysisEditButtonType): void;
}

export interface IDeleteAnalysisFn {
    (idToDelete: string): void;
}

// TODO: add images and points if necessary
export interface IUpdateState {
    details: {
        name: boolean;
        description: boolean;
    };
    conditions: boolean;
}

export interface IEditAnalysisDetails {
    studyId: string;
    name: string;
    description: string;
    analysisId: string;
}

export interface IEditAnalysisPoints {
    // onAddPoint: (arg: { x: number; y: number; z: number }) => void;
    // onRemovePoint: (pointId: string) => void;
    // onUpdatePoint: (pointId: string, update: { x: number; y: number; z: number }) => void;
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

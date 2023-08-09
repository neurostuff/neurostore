import { IMetadataRowModel } from 'components/EditMetadata';
import {
    PointReturn,
    AnalysisReturn,
    ConditionReturn,
    StudyReturn,
} from 'neurostore-typescript-sdk';

export interface MapOrSpaceType {
    value: string;
    label: string;
}

export const DefaultMapTypes: {
    [key: string]: MapOrSpaceType;
} = {
    T: {
        value: 'T',
        label: 'T Map',
    },
    Z: {
        value: 'Z',
        label: 'Z Map',
    },
    F: {
        value: 'F',
        label: 'F Map',
    },
    X2: {
        value: 'X2',
        label: 'Chi Squared Map',
    },
    P: {
        value: 'P',
        label: 'P Map (given null hypothesis)',
    },
    IP: {
        value: 'IP',
        label: '1-P Map ("inverted" probability)',
    },
    M: {
        value: 'M',
        label: 'Multivariate-Beta Map',
    },
    U: {
        value: 'U',
        label: 'Univariate-Beta Map',
    },
    R: {
        value: 'R',
        label: 'ROI/Mask',
    },
    Pa: {
        value: 'Pa',
        label: 'Parcellation',
    },
    A: {
        value: 'A',
        label: 'Anatomical',
    },
    V: {
        value: 'V',
        label: 'Variance',
    },
    OTHER: {
        value: 'OTHER',
        label: 'Other',
    },
};

export const DefaultSpaceTypes: {
    [key: string]: MapOrSpaceType;
} = {
    MNI: {
        value: 'MNI',
        label: 'MNI',
    },
    TAL: {
        value: 'TAL',
        label: 'Talairach',
    },
    OTHER: {
        value: 'OTHER',
        label: 'Other',
    },
};

export interface IStorePoint extends Omit<PointReturn, 'space' | 'kind' | 'entities' | 'value'> {
    value: number | undefined | null;
    isNew: boolean;
}

export interface IStoreAnalysis extends Omit<AnalysisReturn, 'conditions' | 'points'> {
    isNew: boolean;
    conditions: IStoreCondition[];
    points: IStorePoint[];
    pointSpace: MapOrSpaceType | undefined;
    pointStatistic: MapOrSpaceType | undefined;
}

export interface IStoreCondition extends ConditionReturn {
    isNew: boolean;
}

export interface IStoreStudy extends Omit<StudyReturn, 'metadata' | 'analyses'> {
    metadata: IMetadataRowModel[];
    analyses: IStoreAnalysis[];
}

export type StudyDetails = Pick<
    StudyReturn,
    'name' | 'description' | 'publication' | 'authors' | 'doi' | 'pmid' | 'year'
>;

export type TStudyStoreActions = {
    initStudyStore: (studyId?: string) => void;
    clearStudyStore: () => void;
    updateStudy: (fieldName: keyof StudyDetails, value: string | number) => void;
    updateStudyInDB: (annotationId: string | undefined) => Promise<void>;
    addOrUpdateStudyMetadataRow: (row: IMetadataRowModel) => void;
    deleteStudyMetadataRow: (key: string) => void;
    addOrUpdateAnalysis: (analysis: Partial<IStoreAnalysis>) => void;
    deleteAnalysis: (analysisId: string) => void;
    createCondition: (condition: IStoreCondition) => IStoreCondition;
    addOrUpdateConditionWeightPairForAnalysis: (
        analysisId: string,
        condition: IStoreCondition,
        weight: number
    ) => void;
    deleteConditionFromAnalysis: (analysisId: string, conditionId: string) => void;
    createAnalysisPoints: (analysisId: string, points: IStorePoint[], index: number) => void;
    deleteAnalysisPoints: (analysisId: string, pointIds: string[]) => void;
    updateAnalysisPoints: (analysisId: string, points: IStorePoint[]) => void;
    setIsValid: (isValid: boolean) => void;
};

export type TStudyStoreMetadata = {
    studyIsEdited: boolean;
    studyIsLoading: boolean;
    conditionsIsEdited: boolean;
    conditionsIsLoading: boolean;
    isError: boolean; // for http errors that occur
    isValid: boolean; // flag denoting if the form is valid
};

export type TStudyStore = {
    study: IStoreStudy;
    conditions: IStoreCondition[];
    storeMetadata: TStudyStoreMetadata;
} & TStudyStoreActions;

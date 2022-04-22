import {
    EAnalysisType,
    IAnalysisComponents,
    IDynamicArgs,
} from '../../pages/MetaAnalyses/MetaAnalysisBuilderPage/MetaAnalysisBuilderPage';
import { AnnotationsApiResponse, StudysetsApiResponse } from '../../utils/api';
import { INavigationButtonFn } from '../NavigationButtons/NavigationButtons';
import { IAutocompleteObject } from '../NeurosynthAutocomplete/NeurosynthAutocomplete';

export const KWARG_STRING = '**kwargs';

export interface IDynamicInputType {
    [key: string]: string | boolean | number | null | undefined | { [key: string]: string };
}

export interface IMetaAnalysisAlgorithm {
    onNext: INavigationButtonFn;
    onUpdate: (arg: Partial<IAnalysisComponents>) => void;
    onArgsUpdate: (arg: Partial<IDynamicArgs>) => void;

    analysisType: EAnalysisType;
    algorithm: IAutocompleteObject | undefined | null;
    estimator: IAutocompleteObject | undefined | null;
    corrector: IAutocompleteObject | undefined | null;
    estimatorArgs: IDynamicInputType;
    correctorArgs: IDynamicInputType;
}

export interface IMetaAnalysisData {
    analysisType: EAnalysisType | undefined;
    studyset: StudysetsApiResponse | undefined | null;
    annotation: AnnotationsApiResponse | undefined | null;

    studysets: StudysetsApiResponse[];
    onUpdate: (arg: Partial<IAnalysisComponents>) => void;
    onNext: INavigationButtonFn;
}

export interface IDynamicForm {
    onUpdate: (arg: IDynamicInputType) => void;
    specification: {
        [key: string]: IParameter;
    };
    values: { [key: string]: any };
}

export interface IDynamicFormInput {
    parameterName: string;
    parameter: IParameter;
    value: any;

    onUpdate: (arg: IDynamicInputType) => void;
}

export interface IParameter {
    description: string;
    type?: 'str' | null | 'float' | 'bool' | string | 'int';
    default: string | number | boolean | null | {};
}

export interface IMetaAnalysisParamsSpecification {
    VERSION: string;
    CBMA: {
        [key: string]: {
            summary: string;
            parameters: {
                [key: string]: IParameter;
            };
        };
    };
    IBMA: {
        [key: string]: {
            summary: string;
            parameters: {
                [key: string]: IParameter;
            };
        };
    };
    CORRECTOR: {
        [key: string]: {
            summary: string;
            parameters: {
                [key: string]: IParameter;
            };
        };
    };
}

import {
    EAnalysisType as EMetaAnalysisType,
    IMetaAnalysisComponents,
    IEstimatorCorrectorArgs,
} from '../../pages/MetaAnalyses/MetaAnalysisBuilderPage/MetaAnalysisBuilderPage';
import { AnnotationsApiResponse, StudysetsApiResponse } from '../../utils/api';
import { INavigationButtonFn } from '../Buttons/NavigationButtons/NavigationButtons';
import { IAutocompleteObject } from '../NeurosynthAutocomplete/NeurosynthAutocomplete';

export const KWARG_STRING = '**kwargs';

interface IMetaAnalysisBuilderStep {
    onUpdate: (arg: Partial<IMetaAnalysisComponents>) => void;
    onNext: INavigationButtonFn;
}

export interface IMetaAnalysisDetails extends IMetaAnalysisBuilderStep {
    metaAnalysisName: string | undefined;
    metaAnalysisDescription: string | undefined;
}

export interface IMetaAnalysisData extends IMetaAnalysisBuilderStep {
    metaAnalysisType: EMetaAnalysisType | undefined;
    studyset: StudysetsApiResponse | undefined | null;
    annotation: AnnotationsApiResponse | undefined | null;
    inclusionColumn: string | undefined | null;
}

export interface IMetaAnalysisAlgorithm extends IMetaAnalysisBuilderStep {
    onArgsUpdate: (arg: Partial<IEstimatorCorrectorArgs>) => void;
    metaAnalysisType: EMetaAnalysisType;
    estimator: IAutocompleteObject | undefined | null;
    corrector: IAutocompleteObject | undefined | null;
    estimatorArgs: IDynamicInputType;
    correctorArgs: IDynamicInputType;
}

/**
 * this interface is extremely flexible as we have to account for a number of types including
 * objects (in the case of kwargs)
 */
export interface IDynamicInputType {
    [key: string]: string | boolean | number | null | undefined | { [key: string]: string };
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

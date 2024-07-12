export const KWARG_STRING = '**kwargs';

export interface IMetaAnalysisSpecDetails {
    metaAnalysisName: string | undefined;
    metaAnalysisDescription: string | undefined;
}

/**
 * this interface is extremely flexible as we have to account for a number of types including
 * objects (in the case of kwargs)
 */
export interface IDynamicValueType {
    [key: string]: string | boolean | number | null | undefined | { [key: string]: string };
}

export interface IDynamicFormInput {
    parameterName: string;
    parameter: IParameter;
    value: any;

    onUpdate: (arg: IDynamicValueType) => void;
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
            FWE_enabled: boolean;
            FWE_parameters: {
                [key: string]: IParameter;
            } | null;
        };
    };
    IBMA: {
        [key: string]: {
            summary: string;
            parameters: {
                [key: string]: IParameter;
            };
            FWE_enabled: boolean;
            FWE_parameters: {
                [key: string]: IParameter;
            } | null;
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

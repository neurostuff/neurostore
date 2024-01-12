import {
    IMetaAnalysisParamsSpecification,
    IDynamicValueType,
} from 'components/MetaAnalysisConfigComponents';
import { EAnalysisType } from 'hooks/metaAnalyses/useCreateAlgorithmSpecification';
import { IAutocompleteObject } from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import metaAnalysisSpec from 'assets/config/meta_analysis_params.json';

const getDefaultValuesForTypeAndParameter = (
    type: EAnalysisType | 'CORRECTOR',
    parameterLabel: string | undefined
): IDynamicValueType => {
    if (type && parameterLabel) {
        const parameters = metaAnalysisSpecification[type][parameterLabel].parameters;
        const defaultVals: IDynamicValueType = {};
        for (const [key, value] of Object.entries(parameters)) {
            if (parameters[key].type === null) {
                // in the case of kwargs or any other input with no default value
                defaultVals[key] = {};
            } else {
                defaultVals[key] = value.default;
            }
        }

        return defaultVals;
    }

    return {};
};

const metaAnalysisSpecification: IMetaAnalysisParamsSpecification = metaAnalysisSpec;

const metaAnalyticAlgorithms: IAutocompleteObject[] = Object.keys(
    metaAnalysisSpecification[EAnalysisType.CBMA]
).map((algoName) => ({
    label: algoName,
    description: metaAnalysisSpecification[EAnalysisType.CBMA][algoName]?.summary || '',
}));

const correctorOptions: IAutocompleteObject[] = Object.keys(
    metaAnalysisSpecification.CORRECTOR
).map((corrector) => ({
    label: corrector,
    description: metaAnalysisSpecification.CORRECTOR[corrector]?.summary,
}));

const correctorOpt =
    correctorOptions.find((corrector) => corrector.label === 'FDRCorrector') || null;
const algorithmOpt = metaAnalyticAlgorithms.find((algo) => algo.label === 'MKDADensity') || null;

export {
    getDefaultValuesForTypeAndParameter,
    metaAnalysisSpecification,
    metaAnalyticAlgorithms,
    correctorOptions,
    correctorOpt,
    algorithmOpt,
};

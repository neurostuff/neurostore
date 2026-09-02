import { IMetaAnalysisParamsSpecification, IDynamicValueType } from 'pages/MetaAnalysis/components/DynamicForm.types';
import { EAnalysisType } from 'hooks/projects/Project.types';
import { IAutocompleteObject } from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import metaAnalysisSpec from 'assets/config/meta_analysis_params.json';

export const getDefaultValuesForAlgorithm = (analysisType: EAnalysisType, algorithm: string | undefined) => {
    if (!analysisType || !algorithm) return {};
    let parameters = metaAnalysisSpecification[analysisType][algorithm].parameters;
    const defaultVals: IDynamicValueType = {};
    for (const [key, value] of Object.entries(parameters)) {
        if (parameters[key].type === null) {
            // in the case of kwargs or any other key-value pair input with no default value
            defaultVals[key] = {};
        } else {
            defaultVals[key] = value.default;
        }
    }
    return defaultVals;
};

export const getDefaultValuesForCorrector = (
    analysisType: EAnalysisType,
    corrector: string | undefined,
    algorithm: string | undefined
) => {
    if (!corrector || !algorithm) return {};
    if (corrector !== 'FDRCorrector' && corrector !== 'FWECorrector') return {};
    let parameters = metaAnalysisSpecification.CORRECTOR[corrector].parameters;

    if (corrector === 'FWECorrector' && metaAnalysisSpecification?.[analysisType]?.[algorithm]?.FWE_enabled) {
        const FWE_parameters = metaAnalysisSpecification?.[analysisType]?.[algorithm]?.FWE_parameters;
        if (FWE_parameters) {
            parameters = { ...FWE_parameters, method: { ...parameters.method, default: 'montecarlo' } };
        }
    }
    const defaultVals: IDynamicValueType = {};
    for (const [key, value] of Object.entries(parameters)) {
        if (parameters[key].type === null) {
            // in the case of kwargs or any other key-value pair input with no default value
            defaultVals[key] = {};
        } else {
            defaultVals[key] = value.default;
        }
    }
    return defaultVals;
};

export const metaAnalysisSpecification: IMetaAnalysisParamsSpecification = metaAnalysisSpec;

/** IBMA MVP: only expose these estimators in the create/select UI. Full params remain in meta_analysis_params.json. */
const IBMA_MVP_ALGORITHM_LABELS = new Set(['Fishers', 'Stouffers']);

export const getMetaAnalyticAlgorithms = (analysisType: EAnalysisType): IAutocompleteObject[] => {
    const algorithmLabels = Object.keys(metaAnalysisSpecification[analysisType]).filter(
        (algoName) => analysisType !== EAnalysisType.IBMA || IBMA_MVP_ALGORITHM_LABELS.has(algoName)
    );
    return algorithmLabels.map((algoName) => ({
        label: algoName,
        description: metaAnalysisSpecification[analysisType][algoName]?.summary || '',
    }));
};

export const getAlgorithmDefaultOption = (analysisType: EAnalysisType): IAutocompleteObject | null => {
    const algorithms = getMetaAnalyticAlgorithms(analysisType);
    if (analysisType === EAnalysisType.CBMA) {
        return algorithms.find((algo) => algo.label === 'MKDADensity') || algorithms[0] || null;
    }
    if (analysisType === EAnalysisType.IBMA) {
        return algorithms.find((algo) => algo.label === 'Stouffers') || algorithms[0] || null;
    }
    return algorithms[0] || null;
};

// In the future, we may allow FWE, but for now, IBMA only supports FDR.
export const getMetaAnalyticCorrectors = (analysisType: EAnalysisType): IAutocompleteObject[] => {
    return Object.keys(metaAnalysisSpecification.CORRECTOR)
        .filter((corrector) => {
            if (analysisType === EAnalysisType.IBMA) {
                return corrector !== 'FWECorrector';
            }
            return true;
        })
        .map((corrector) => ({
            label: corrector,
            description: metaAnalysisSpecification.CORRECTOR[corrector]?.summary,
        }));
};

export const getCorrectorDefaultOption = (analysisType: EAnalysisType): IAutocompleteObject | null => {
    return getMetaAnalyticCorrectors(analysisType).find((corrector) => corrector.label === 'FDRCorrector') || null;
};

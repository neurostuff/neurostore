import { IMetaAnalysisParamsSpecification, IDynamicValueType } from 'pages/MetaAnalysis/components/DynamicForm.types';
import { EAnalysisType } from 'hooks/projects/Project.types';
import { IAutocompleteObject } from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import metaAnalysisSpec from 'assets/config/meta_analysis_params.json';

const getDefaultValuesForTypeAndParameter = (
    type: EAnalysisType | 'CORRECTOR',
    parameterLabel: string | undefined,
    estimatorReferenceLabel?: string | undefined,
    estimatorReferenceType?: EAnalysisType
): IDynamicValueType => {
    if (!type || !parameterLabel) return {};

    let parameters = metaAnalysisSpecification[type][parameterLabel].parameters;
    if (
        type === 'CORRECTOR' &&
        parameterLabel === 'FWECorrector' &&
        estimatorReferenceLabel &&
        estimatorReferenceType &&
        metaAnalysisSpecification[estimatorReferenceType][estimatorReferenceLabel].FWE_enabled === true
    ) {
        const FWE_parameters =
            metaAnalysisSpecification[estimatorReferenceType][estimatorReferenceLabel].FWE_parameters;
        if (FWE_parameters !== null) {
            FWE_parameters['method'] = { ...parameters['method'] };
            FWE_parameters['method'].default = 'montecarlo';
            parameters = FWE_parameters;
        }
    }
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
};

const metaAnalysisSpecification: IMetaAnalysisParamsSpecification = metaAnalysisSpec;

/** IBMA MVP: only expose these estimators in the create/select UI. Full params remain in meta_analysis_params.json. */
const IBMA_MVP_ALGORITHM_LABELS = new Set(['Fishers', 'Stouffers']);

const getMetaAnalyticAlgorithms = (analysisType: EAnalysisType): IAutocompleteObject[] => {
    const algorithmLabels = Object.keys(metaAnalysisSpecification[analysisType]).filter(
        (algoName) => analysisType !== EAnalysisType.IBMA || IBMA_MVP_ALGORITHM_LABELS.has(algoName)
    );
    return algorithmLabels.map((algoName) => ({
        label: algoName,
        description: metaAnalysisSpecification[analysisType][algoName]?.summary || '',
    }));
};

const getAlgorithmDefaultOption = (analysisType: EAnalysisType): IAutocompleteObject | null => {
    const algorithms = getMetaAnalyticAlgorithms(analysisType);
    if (analysisType === EAnalysisType.CBMA) {
        return algorithms.find((algo) => algo.label === 'MKDADensity') || algorithms[0] || null;
    }
    if (analysisType === EAnalysisType.IBMA) {
        return algorithms.find((algo) => algo.label === 'Fishers') || algorithms[0] || null;
    }
    return algorithms[0] || null;
};

const correctorOptions: IAutocompleteObject[] = Object.keys(metaAnalysisSpecification.CORRECTOR).map((corrector) => ({
    label: corrector,
    description: metaAnalysisSpecification.CORRECTOR[corrector]?.summary,
}));

const correctorDefaultOption = correctorOptions.find((corrector) => corrector.label === 'FDRCorrector') || null;

export {
    getDefaultValuesForTypeAndParameter,
    getMetaAnalyticAlgorithms,
    getAlgorithmDefaultOption,
    metaAnalysisSpecification,
    correctorOptions,
    correctorDefaultOption,
};
